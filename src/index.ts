// CSF glue: turns a program + named fixture Models into Storybook story
// objects whose `render` mounts through mountFoldkitStory. v0 is
// static-stories-only by design — see README Limits.
import type { Layer } from "effect";

import { mountFoldkitStory, type FoldkitProgram } from "./mount.ts";

export interface FoldkitMeta<Model, Message> {
  readonly title: string;
  readonly program: FoldkitProgram<Model, Message>;
  /** Optional resources layer shared by every story in the file. */
  readonly resources?: Layer.Layer<never>;
}

export interface FoldkitStory {
  /** Storybook's canvas; the adapter mounts into it fresh per render. */
  render: (canvas: { canvasElement: HTMLElement }) => void;
};

export function foldkitStories<Model, Message>(
  meta: FoldkitMeta<Model, Message>,
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
      render: ({ canvasElement }: { canvasElement: HTMLElement }) => {
        canvasElement.replaceChildren();
        mountFoldkitStory({
          program: meta.program,
          model,
          ...(meta.resources ? { resources: meta.resources } : {}),
          container: canvasElement,
        });
      },
    }),
  };
}

export { mountFoldkitStory } from "./mount.ts";
export type { FoldkitProgram, MountOptions, MountedStory } from "./mount.ts";
