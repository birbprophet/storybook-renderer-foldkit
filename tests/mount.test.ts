import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { Html, HtmlBuilder } from "foldkit/html";
import { describe, expect, test, vi } from "vitest";

import {
  createFoldkitStory,
  foldkitStories,
  mountFoldkitStory,
} from "../src/index.ts";

const Model = S.Struct({ count: S.Number, label: S.String });
type Model = typeof Model.Type;

const Args = S.Struct({ count: S.Number, label: S.String });
type Args = typeof Args.Type;

type Message = Readonly<{ _tag: "Increment" }>;
const Increment = (): Message => ({ _tag: "Increment" });

const programImpl = {
  Model,
  update: (model: Model, _message: Message): readonly [Model, []] => [
    { ...model, count: model.count + 1 },
    [],
  ],
  view: (model: Model, h: HtmlBuilder<Message>): { body: Html } => ({
    body: h.button([h.OnClick(Increment())], [`${model.label}: ${model.count}`]),
  }),
};
const program = programImpl as never;

const liveStory = () =>
  createFoldkitStory<Args, Model, Message>({
    ...programImpl,
    Args,
    init: (args) => [args, []],
  });

const render = (story: ReturnType<typeof liveStory>, args: Args, id = "example--live") => {
  const canvasElement = document.createElement("div");
  story.render(args, { canvasElement, id });
  return canvasElement;
};

describe("live stories", () => {
  test("decode args and render the initial model", async () => {
    const story = liveStory();
    const canvasElement = document.createElement("div");
    const returned = story.render(
      { count: 7, label: "Count" },
      { canvasElement, id: "example--live" },
    );
    expect(returned).toBe(canvasElement.firstElementChild);
    const canvas = canvasElement;
    await vi.waitFor(() => expect(canvas.textContent).toBe("Count: 7"));
  });

  test("route messages through update", async () => {
    const canvas = render(liveStory(), { count: 1, label: "Count" });
    await vi.waitFor(() => expect(canvas.querySelector("button")).not.toBeNull());
    canvas.querySelector("button")?.click();
    await vi.waitFor(() => expect(canvas.textContent).toBe("Count: 2"));
  });

  test("run commands returned by init", async () => {
    const story = createFoldkitStory<Args, Model, Message>({
      ...programImpl,
      Args,
      init: (args) => [
        args,
        [{ name: "IncrementOnBoot", effect: Effect.succeed(Increment()) }],
      ],
    });
    const canvasElement = document.createElement("div");
    story.render(
      { count: 3, label: "Count" },
      { canvasElement, id: "example--boot-command" },
    );
    await vi.waitFor(() => expect(canvasElement.textContent).toBe("Count: 4"));
  });

  test("remount when Controls supply new args", async () => {
    const story = liveStory();
    const canvas = render(story, { count: 1, label: "Before" });
    const firstHost = canvas.firstElementChild;
    story.render(
      { count: 9, label: "After" },
      { canvasElement: canvas, id: "example--live" },
    );
    await vi.waitFor(() => expect(canvas.textContent).toBe("After: 9"));
    expect(firstHost?.isConnected).toBe(false);
    expect(canvas.children).toHaveLength(1);
  });

  test("reject invalid Controls args before mounting", () => {
    const canvasElement = document.createElement("div");
    expect(() =>
      liveStory().render(
        { count: "not-a-number", label: "Count" } as never,
        { canvasElement, id: "example--live" },
      ),
    ).toThrow();
    expect(canvasElement.children).toHaveLength(0);
  });

  test("mount simultaneous canvases with context-derived identities", () => {
    const first = render(liveStory(), { count: 1, label: "First" }, "example--first");
    const second = render(liveStory(), { count: 2, label: "Second" }, "example--second");
    expect(first.firstElementChild?.getAttribute("data-foldkit-story-id")).toBe(
      "example--first",
    );
    expect(second.firstElementChild?.getAttribute("data-foldkit-story-id")).toBe(
      "example--second",
    );
  });
});

describe("compatibility pins", () => {
  test("pin the exact certified dependency versions", () => {
    const root = process.cwd();
    const manifest = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
    expect(manifest).toMatchObject({
      dependencies: { effect: "4.0.0-rc.111", foldkit: "0.149.0" },
      devDependencies: {
        "@foldkit/vite-plugin": "0.17.0",
        "@storybook/html": "10.5.10",
      },
      version: "0.2.0",
    });
  });

  test("keep the runtime compatibility boundary in src/mount.ts", () => {
    const root = process.cwd();
    const found = execFileSync(
      "git",
      ["grep", "-l", "--fixed-strings", "from \"foldkit\"", "--", "src/*.ts"],
      { cwd: root, encoding: "utf8" },
    )
      .trim()
      .split("\n");
    expect(found).toStrictEqual(["src/mount.ts"]);
  });
});

describe("mount boundary", () => {
  test("cleans up idempotently", () => {
    const canvas = document.createElement("div");
    const mounted = mountFoldkitStory({
      container: canvas,
      id: "example--cleanup",
      initial: [{ count: 7, label: "Count" }, []],
      program,
    });
    mounted.destroy();
    mounted.destroy();
    expect(canvas.contains(mounted.host)).toBe(false);
  });

  test("accepts a resource layer", () => {
    const canvas = document.createElement("div");
    expect(() =>
      mountFoldkitStory({
        container: canvas,
        id: "example--resources",
        initial: [{ count: 7, label: "Count" }, []],
        program,
        resources: Layer.empty,
      }),
    ).not.toThrow();
  });

  test("reports view crashes with story context", async () => {
    const onCrash = vi.fn();
    const crashing = {
      ...programImpl,
      view: () => {
        throw new Error("broken view");
      },
    } as never;
    mountFoldkitStory({
      container: document.createElement("div"),
      id: "example--crash",
      initial: [{ count: 0, label: "Count" }, []],
      onCrash,
      program: crashing,
    });
    await vi.waitFor(() => expect(onCrash).toHaveBeenCalled());
  });
});

test("static foldkitStories remains a compatibility wrapper", () => {
  const stories = foldkitStories<Model, Message>({
    title: "Example/Counter",
    program,
  });
  const story = stories.story("Seven", { count: 7, label: "Count" });
  const canvasElement = document.createElement("div");
  story.render({}, { canvasElement, id: "example--seven" });
  expect(stories.default.title).toBe("Example/Counter");
  expect(story.name).toBe("Seven");
});
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as Effect from "effect/Effect";
