// CSF glue: turns a program + named fixture Models into Storybook story
// objects whose `render` mounts through mountFoldkitStory. v0 is
// static-stories-only by design — see README Limits.
import type { Layer } from "effect";

import { mountFoldkitStory, type FoldkitProgram } from "./mount.ts";

export interface FoldkitMeta<Model, Message, R = never> {
  readonly title: string;
  readonly program: FoldkitProgram<Model, Message, R>;
  /** Optional resources layer shared by every story in the file. */
  readonly resources?: Layer.Layer<R, never>;
}

export interface FoldkitStory {
  /** Storybook invokes render(args, context); we mount into
   * context.canvasElement and return void. */
  render: (
    args: Record<string, never>,
    context: { canvasElement: HTMLElement },
  ) => void;
}

export function foldkitStories<Model, Message, R = never>(
  meta: FoldkitMeta<Model, Message, R>,
): {
  readonly default: {
    readonly title: string;
    readonly tags: readonly string[];
  };
  readonly story: (name: string, model: Model) => FoldkitStory;
} {
  return {
    default: { title: meta.title, tags: ["foldkit"] },
    story: (name: string, model: Model) => ({
      name,
      // Storybook invokes render(args, context); the html framework clears
      // the canvas itself, so mount into context.canvasElement and return
      // void — never a node (returning one makes the framework append a
      // second copy).
      render: (
        _args: Record<string, never>,
        context: { canvasElement: HTMLElement },
      ): void => {
        const canvasElement = context.canvasElement;
        canvasElement.replaceChildren();
        mountFoldkitStory<Model, Message, R>({
          program: meta.program,
          model,
          resources: meta.resources,
          container: canvasElement,
        });
      },
    }),
  };
}

export { mountFoldkitStory } from "./mount.ts";
export type { FoldkitProgram, MountOptions, MountedStory } from "./mount.ts";
