import { Schema as S } from "effect";
import { m } from "foldkit/message";
import { expect, test } from "vitest";

import { foldkitStories, mountFoldkitStory } from "../src/index.ts";

// A minimal program with the same shape an app barrel re-exports.
const Model = S.Struct({ count: S.Number });
type Model = typeof Model.Type;

const ClickedIncrement = m("ClickedIncrement");
const Message = S.Union([ClickedIncrement]);
type Message = typeof Message.Type;

// The view stub is loosely typed on purpose: the adapter owns the real
// HtmlBuilder contract; this file only proves mount/cleanup behaviour.
const program = {
  Model,
  update: (model: Model, _message: Message): readonly [Model, []] => [
    { count: model.count + 1 },
    [],
  ],
  view: (model: Model, h: { div: (attrs: unknown[], kids: string[]) => unknown }) =>
    h.div([], [`count: ${model.count}`]),
} as never;

test("mounts a story into the canvas and cleans up", () => {
  const canvas = document.createElement("div");
  const mounted = mountFoldkitStory({
    program: program as never,
    model: { count: 7 },
    container: canvas,
  });

  expect(canvas.contains(mounted.host)).toBe(true);
  mounted.destroy();
  expect(canvas.contains(mounted.host)).toBe(false);
});

test("foldkitStories produces CSF-shaped stories", () => {
  const stories = foldkitStories<Model, Message>({
    title: "Example/Counter",
    program,
  });
  const story = stories.story("seven", { count: 7 });

  expect(stories.default.title).toBe("Example/Counter");
  expect(stories.default.tags).toContain("foldkit");
  const canvas = { canvasElement: document.createElement("div") };
  expect(() => story.render({}, canvas)).not.toThrow();
  expect(canvas.canvasElement.children.length).toBe(1);
});
