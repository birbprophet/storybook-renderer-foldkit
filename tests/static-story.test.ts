import * as S from "effect/Schema";
import type { HtmlBuilder } from "foldkit/html";
import { describe, expect, test, vi } from "vitest";

import { staticStory, type FoldkitStory } from "../src/index.ts";

const Args = S.Struct({ count: S.Number, label: S.String });
type Args = typeof Args.Type;

type Message = Readonly<{ _tag: "Clicked" }>;
const Clicked = (): Message => ({ _tag: "Clicked" });

const render = (story: FoldkitStory<Args>, args: Args) => {
  const canvasElement = document.createElement("div");
  canvasElement.appendChild(story.render(args, { canvasElement, id: "example--static" }));
  return canvasElement;
};

describe("staticStory", () => {
  test("renders the args through the view", async () => {
    const story = staticStory<Args>({
      Args,
      view: (model, h: HtmlBuilder<never>) => h.div([], [`${model.label}: ${model.count}`]),
    });
    const canvas = render(story, { count: 7, label: "Count" });
    await vi.waitFor(() => expect(canvas.textContent).toBe("Count: 7"));
  });

  test("renders a view that emits ignorable messages", async () => {
    const story = staticStory<Args, Message>({
      Args,
      view: (model, h: HtmlBuilder<Message>) =>
        h.button([h.OnClick(Clicked())], [`${model.label}: ${model.count}`]),
    });
    const canvas = render(story, { count: 1, label: "Count" });
    await vi.waitFor(() => expect(canvas.querySelector("button")).not.toBeNull());
    canvas.querySelector("button")?.click();
    await vi.waitFor(() => expect(canvas.textContent).toBe("Count: 1"));
  });
});
