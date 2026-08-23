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
  render(args: Args, context: StoryContext): void;
}

export interface FoldkitStoryDefinition<Args, Model, Message, R = never>
  extends FoldkitProgram<Model, Message, R> {
  readonly Args: Schema.Codec<Args, unknown, never>;
  readonly init: (args: Args) => InitialState<Model, Message, R>;
  readonly resources?: Layer.Layer<R, never>;
  readonly onCrash?: (error: unknown) => void;
}

const mountedCanvases = new WeakMap<HTMLElement, MountedStory>();

export function createFoldkitStory<Args, Model, Message, R = never>(
  definition: FoldkitStoryDefinition<Args, Model, Message, R>,
): FoldkitStory<Args> {
  return {
    render(args, context): void {
      const decoded = Schema.decodeUnknownSync(definition.Args)(args);
      mountedCanvases.get(context.canvasElement)?.destroy();
      context.canvasElement.replaceChildren();

      const mounted = mountFoldkitStory({
        container: context.canvasElement,
        id: context.id,
        initial: definition.init(decoded),
        onCrash: definition.onCrash,
        program: definition,
        resources: definition.resources,
      });
      mountedCanvases.set(context.canvasElement, mounted);
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
