// The compatibility boundary (mirrors astro-renderer-foldkit's adapter.ts):
// the only file that touches Storybook's canvas contract AND FoldKit's
// runtime. Everything else composes this.
//
// Mount contract, verified against foldkit@0.148.2 dist sources (2026-08-22):
//   - runtime.js makeElement wraps the element view as
//     { title: "", body: elementView(model, h) } — so the element `view`
//     returns the VNode directly, i.e. the program result's `.body`.
//   - vdom.js patchFreshInto REPLACES the container node with the rendered
//     root; therefore we pass a disposable seat inside a wrapper we own.
//     Unmounting = removing the wrapper.
//   - The container must carry an id (HMR model preservation check).
//
// v0 scope: static named-fixture stories. No args table, no knobs/docs
// addons, no subscriptions — a story boots once per canvas render.
import type { Layer, Schema } from "effect";
import type { Command } from "foldkit/command";
import type { HtmlBuilder } from "foldkit/html";
import { Runtime } from "foldkit";

/** The program surface a consumer re-exports from their app barrel
 * (`main.ts` per ADR-style layouts): everything except init/subscriptions,
 * because stories boot from fixture Models, never from init side effects. */
export interface FoldkitProgram<Model, Message, R = never> {
  readonly Model: Schema.Codec<Model, any, unknown, unknown>;
  readonly update: (
    model: Model,
    message: Message,
  ) => readonly [Model, ReadonlyArray<Command<Message, never, R>>];
  /** Root view. May return the full Document; only `.body` is mounted. */
  readonly view: (model: Model, h: HtmlBuilder<Message>) => { body: unknown };
}

export interface MountOptions<Model, Message, R = never> {
  readonly program: FoldkitProgram<Model, Message, R>;
  /** The fixture Model this story renders. */
  readonly model: Model;
  /** Layer providing exactly the R channel the program's commands require
   * (e.g. a fixture ApiClient layer). */
  readonly resources?: Layer.Layer<R, never>;
  /** Element hosting the story; the mount lands inside a child wrapper. */
  readonly container: HTMLElement;
}

export interface MountedStory {
  /** Stable wrapper around whatever the runtime rendered. Remove to unmount. */
  readonly host: HTMLDivElement;
  /** Convenience teardown: drops the wrapper node. */
  destroy(): void;
}

let mountSeq = 0;

export function mountFoldkitStory<Model, Message, R = never>(
  options: MountOptions<Model, Message, R>,
): MountedStory {
  const document = options.container.ownerDocument;

  const wrapper = document.createElement("div");
  const seat = document.createElement("div");
  // The runtime refuses seats without an id (HMR model preservation).
  // Math.random is fine here: delivery tooling, not the pure update/view
  // domain the purity rules govern.
  seat.id = `foldkit-story-${(++mountSeq).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  wrapper.appendChild(seat);
  options.container.appendChild(wrapper);

  // Typed as a bag on purpose: TS7 cannot verify the consumer's concrete
  // Model/Message pair against the runtime's generic element config; the cast
  // below is the single contained escape hatch.
  const config: Record<string, unknown> = {
    Model: options.program.Model,
    init: () => [options.model, []],
    update: options.program.update,
    // makeElement wraps this as { title: "", body: <return> }, so return the
    // program result's `.body`. The builder arrives in the runtime's inferred
    // universe; one contained cast hands it to the consumer's view.
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    view: (model: Model, h: any) =>
      options.program.view(model, h as unknown as HtmlBuilder<Message>).body,
    ...(options.resources ? { resources: options.resources } : {}),
    crash: {
      report: (context: { error: unknown }) =>
        console.error(
          "[storybook-renderer-foldkit] crash:",
          (context.error as Error)?.stack ?? context.error,
        ),
    },
    container: seat,
  };

  Runtime.run(Runtime.makeElement(config as never) as never);

  return {
    host: wrapper,
    destroy() {
      wrapper.remove();
    },
  };
}
