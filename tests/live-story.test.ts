import * as S from "effect/Schema";
import type { HtmlBuilder } from "foldkit/html";
import { describe, expect, test, vi } from "vitest";

import { liveStory, type FoldkitStory } from "../src/index.ts";

const Args = S.Struct({ count: S.Number, label: S.String });
type Args = typeof Args.Type;

type Message = Readonly<{ _tag: "Increment" }>;
const Increment = (): Message => ({ _tag: "Increment" });

const render = (story: FoldkitStory<Args>, args: Args) => {
  const canvasElement = document.createElement("div");
  canvasElement.appendChild(story.render(args, { canvasElement, id: "example--live" }));
  return canvasElement;
};

describe("liveStory", () => {
  test("renders the initial model through the bare view", async () => {
    const story = liveStory<Args, Args, Message>({
      Args,
      Model: Args,
      init: (args) => args,
      update: (model) => model,
      view: (model, h: HtmlBuilder<Message>) => h.div([], [`${model.label}: ${model.count}`]),
    });
    const canvas = render(story, { count: 7, label: "Count" });
    await vi.waitFor(() => expect(canvas.textContent).toBe("Count: 7"));
  });

  test("routes messages through the bare update", async () => {
    const story = liveStory<Args, Args, Message>({
      Args,
      Model: Args,
      init: (args) => args,
      update: (model) => ({ ...model, count: model.count + 1 }),
      view: (model, h: HtmlBuilder<Message>) =>
        h.button([h.OnClick(Increment())], [`${model.label}: ${model.count}`]),
    });
    const canvas = render(story, { count: 1, label: "Count" });
    await vi.waitFor(() => expect(canvas.querySelector("button")).not.toBeNull());
    canvas.querySelector("button")?.click();
    await vi.waitFor(() => expect(canvas.textContent).toBe("Count: 2"));
  });
});
