import type { Layer, Schema } from "effect";
import { Runtime } from "foldkit";
import type { Command } from "foldkit/command";
import type { HtmlBuilder } from "foldkit/html";

export type InitialState<Model, Message, R> = readonly [
  Model,
  ReadonlyArray<Command<Message, never, R>>,
];

export interface FoldkitProgram<Model, Message, R = never> {
  readonly Model: Schema.Codec<Model, any, unknown, unknown>;
  readonly update: (
    model: Model,
    message: Message,
  ) => readonly [Model, ReadonlyArray<Command<Message, never, R>>];
  readonly view: (model: Model, h: HtmlBuilder<Message>) => { body: unknown };
}

export interface MountOptions<Model, Message, R = never> {
  readonly container: HTMLElement;
  readonly host?: HTMLDivElement;
  readonly id: string;
  readonly initial: InitialState<Model, Message, R>;
  readonly onCrash?: (error: unknown) => void;
  readonly program: FoldkitProgram<Model, Message, R>;
  readonly resources?: Layer.Layer<R, never>;
}

export interface MountedStory {
  readonly host: HTMLDivElement;
  destroy(): void;
}

const safeId = (id: string): string => id.replaceAll(/[^a-zA-Z0-9_-]/gu, "-");

const observerFor = (document: Document): typeof MutationObserver =>
  document.defaultView?.MutationObserver ?? MutationObserver;

export function mountFoldkitStory<Model, Message, R = never>(
  options: MountOptions<Model, Message, R>,
): MountedStory {
  const document = options.container.ownerDocument;
  const host = options.host ?? document.createElement("div");
  host.dataset.foldkitStoryId = options.id;
  const seat = document.createElement("div");
  seat.dataset.foldkitStorySeat = "";
  seat.id = `foldkit-story-${safeId(options.id)}`;
  host.appendChild(seat);
  host.dataset.foldkitState = "mounting";
  if (host.parentElement !== options.container) {
    options.container.appendChild(host);
  }

  const markReady = () => {
    const runtimeReplacedSeat = seat.parentElement !== host && host.childNodes.length > 0;
    const runtimeFilledSeat = seat.parentElement === host && seat.childNodes.length > 0;
    if (host.dataset.foldkitState === "mounting" && (runtimeReplacedSeat || runtimeFilledSeat)) {
      host.dataset.foldkitState = "ready";
      readinessObserver.disconnect();
    }
  };
  const ReadinessObserver = observerFor(document);
  const readinessObserver = new ReadinessObserver(markReady);
  readinessObserver.observe(host, {
    characterData: true,
    childList: true,
    subtree: true,
  });

  const reportCrash = (error: unknown) => {
    if (host.dataset.foldkitState === "crashed") return;
    host.dataset.foldkitState = "crashed";
    readinessObserver.disconnect();
    if (options.onCrash) options.onCrash(error);
    else console.error("[storybook-renderer-foldkit] crash:", error);
  };

  const config: Record<string, unknown> = {
    Model: options.program.Model,
    init: () => options.initial,
    update: options.program.update,
    view: (model: Model, h: unknown) =>
      options.program.view(model, h as HtmlBuilder<Message>).body,
    ...(options.resources ? { resources: options.resources } : {}),
    crash: {
      report: (context: { error: unknown }) => reportCrash(context.error),
    },
    container: seat,
  };

  let handle: ReturnType<typeof Runtime.embed> | undefined;
  try {
    handle = Runtime.embed(Runtime.makeElement(config as never) as never);
  } catch (error) {
    reportCrash(error);
  }
  queueMicrotask(markReady);

  let destroyed = false;
  return {
    host,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      readinessObserver.disconnect();
      handle?.dispose();
      host.remove();
    },
  };
}
