import type { Layer } from "effect";
import * as Schema from "effect/Schema";

import {
  mountFoldkitStory,
  type FoldkitProgram,
  type InitialState,
  type MountedStory,
} from "./mount.ts";

export interface StoryContext {
  readonly canvasElement: HTMLElement;
  readonly id: string;
}

export interface FoldkitStory<Args> {
  readonly args?: Partial<Args>;
  readonly name?: string;
  render(args: Args, context: StoryContext): HTMLElement;
}

export interface FoldkitStoryDefinition<Args, Model, Message, R = never>
  extends FoldkitProgram<Model, Message, R> {
  readonly Args: Schema.Codec<Args, unknown, never>;
  readonly init: (args: Args) => InitialState<Model, Message, R>;
  readonly resources?: Layer.Layer<R, never>;
  readonly onCrash?: (error: unknown) => void;
}

interface StoryLifecycle {
  destroy(): void;
}

const mountedCanvases = new WeakMap<HTMLElement, StoryLifecycle>();

export interface WaitForFoldkitStoryOptions {
  readonly signal?: AbortSignal;
}

export function waitForFoldkitStory(
  canvasElement: HTMLElement,
  options: WaitForFoldkitStoryOptions = {},
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    let observer: MutationObserver | undefined;
    const cleanup = () => {
      observer?.disconnect();
      options.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(options.signal?.reason ?? new DOMException("FoldKit story wait aborted", "AbortError"));
    };
    const inspect = () => {
      const host = canvasElement.querySelector<HTMLElement>("[data-foldkit-story-id]");
      if (host?.dataset.foldkitState === "ready") {
        cleanup();
        resolve(host);
      } else if (host?.dataset.foldkitState === "crashed") {
        cleanup();
        reject(new Error(`FoldKit story ${host.dataset.foldkitStoryId ?? "unknown"} crashed`));
      }
    };

    if (options.signal?.aborted === true) {
      onAbort();
      return;
    }
    observer = new MutationObserver(inspect);
    observer.observe(canvasElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    options.signal?.addEventListener("abort", onAbort, { once: true });
    inspect();
  });
}

export function createFoldkitStory<Args, Model, Message, R = never>(
  definition: FoldkitStoryDefinition<Args, Model, Message, R>,
): FoldkitStory<Args> {
  return {
    render(args, context): HTMLElement {
      const decoded = Schema.decodeUnknownSync(definition.Args)(args);
      mountedCanvases.get(context.canvasElement)?.destroy();
      mountedCanvases.delete(context.canvasElement);

      const host = context.canvasElement.ownerDocument.createElement("div");
      host.dataset.foldkitStoryId = context.id;
      host.dataset.foldkitState = "mounting";
      let destroyed = false;
      let mounted: MountedStory | undefined;
      const mountWhenAttached = () => {
        if (destroyed || mounted !== undefined || host.parentElement !== context.canvasElement) {
          return;
        }
        attachmentObserver.disconnect();
        mounted = mountFoldkitStory({
          container: context.canvasElement,
          host,
          id: context.id,
          initial: definition.init(decoded),
          onCrash: definition.onCrash,
          program: definition,
          resources: definition.resources,
        });
      };
      const attachmentObserver = new MutationObserver(mountWhenAttached);
      attachmentObserver.observe(context.canvasElement, { childList: true });
      const lifecycle: StoryLifecycle = {
        destroy() {
          if (destroyed) return;
          destroyed = true;
          attachmentObserver.disconnect();
          mounted?.destroy();
          host.remove();
        },
      };
      mountedCanvases.set(context.canvasElement, lifecycle);
      queueMicrotask(mountWhenAttached);
      return host;
    },
  };
}

export interface FoldkitMeta<Model, Message, R = never> {
  readonly title: string;
  readonly program: FoldkitProgram<Model, Message, R>;
  readonly resources?: Layer.Layer<R, never>;
}

const NoArgs = Schema.Struct({});

export function foldkitStories<Model, Message, R = never>(
  meta: FoldkitMeta<Model, Message, R>,
): {
  readonly default: { readonly title: string; readonly tags: readonly string[] };
  readonly story: (name: string, model: Model) => FoldkitStory<Record<string, never>>;
} {
  return {
    default: { title: meta.title, tags: ["foldkit"] },
    story: (name, model) => ({
      ...createFoldkitStory({
        ...meta.program,
        Args: NoArgs,
        init: () => [model, []],
        resources: meta.resources,
      }),
      name,
    }),
  };
}

export { mountFoldkitStory } from "./mount.ts";
export type {
  FoldkitProgram,
  InitialState,
  MountOptions,
  MountedStory,
} from "./mount.ts";
