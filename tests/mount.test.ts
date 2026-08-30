import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { Html, HtmlBuilder } from "foldkit/html";
import { describe, expect, test, vi } from "vitest";

import {
  createFoldkitStory,
  foldkitStories,
  mountFoldkitStory,
  waitForFoldkitStory,
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

const renderThroughStorybookHtml = (storyFn: () => HTMLElement, canvasElement: HTMLElement) => {
  const element = storyFn();
  canvasElement.innerHTML = "";
  canvasElement.appendChild(element);
};

const render = (story: ReturnType<typeof liveStory>, args: Args, id = "example--live") => {
  const canvasElement = document.createElement("div");
  renderThroughStorybookHtml(() => story.render(args, { canvasElement, id }), canvasElement);
  return canvasElement;
};

describe("live stories", () => {
  test("decode args and render the initial model", async () => {
    const story = liveStory();
    const canvasElement = document.createElement("div");
    renderThroughStorybookHtml(
      () => story.render({ count: 7, label: "Count" }, { canvasElement, id: "example--live" }),
      canvasElement,
    );
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
      init: (args) => [args, [{ name: "IncrementOnBoot", effect: Effect.succeed(Increment()) }]],
    });
    const canvasElement = document.createElement("div");
    renderThroughStorybookHtml(
      () =>
        story.render({ count: 3, label: "Count" }, { canvasElement, id: "example--boot-command" }),
      canvasElement,
    );
    await vi.waitFor(() => expect(canvasElement.textContent).toBe("Count: 4"));
  });

  test("remount when Controls supply new args", async () => {
    const story = liveStory();
    const canvas = render(story, { count: 1, label: "Before" });
    const firstHost = canvas.firstElementChild;
    renderThroughStorybookHtml(
      () =>
        story.render({ count: 9, label: "After" }, { canvasElement: canvas, id: "example--live" }),
      canvas,
    );
    await waitForFoldkitStory(canvas);
    await vi.waitFor(() => expect(canvas.textContent).toBe("After: 9"));
    expect(firstHost?.isConnected).toBe(false);
    expect(canvas.children).toHaveLength(1);
  });

  test("reject invalid Controls args before mounting", () => {
    const canvasElement = document.createElement("div");
    expect(() =>
      liveStory().render({ count: "not-a-number", label: "Count" } as never, {
        canvasElement,
        id: "example--live",
      }),
    ).toThrow();
    expect(canvasElement.children).toHaveLength(0);
  });

  test("mount simultaneous canvases with context-derived identities", async () => {
    const first = render(liveStory(), { count: 1, label: "First" }, "example--first");
    const second = render(liveStory(), { count: 2, label: "Second" }, "example--second");
    await Promise.all([waitForFoldkitStory(first), waitForFoldkitStory(second)]);
    expect(first.firstElementChild?.getAttribute("data-foldkit-story-id")).toBe("example--first");
    expect(second.firstElementChild?.getAttribute("data-foldkit-story-id")).toBe("example--second");
  });

  test("mounts the original returned host when Storybook attaches it after the first microtask", async () => {
    const story = liveStory();
    const canvasElement = document.createElement("div");
    const host = story.render(
      { count: 4, label: "Detached" },
      { canvasElement, id: "example--detached" },
    );
    await Promise.resolve();
    expect(host.textContent).toBe("");

    canvasElement.appendChild(host);
    await vi.waitFor(() => expect(host.textContent).toBe("Detached: 4"));
    await vi.waitFor(() => expect(host.dataset.foldkitState).toBe("ready"));
    await waitForFoldkitStory(canvasElement);
    expect(canvasElement.textContent).toBe("Detached: 4");
  });

  test("readiness resolves only after the first FoldKit DOM commit from one render", async () => {
    const story = liveStory();
    const canvasElement = document.createElement("div");
    const host = story.render(
      { count: 4, label: "Cold iframe" },
      { canvasElement, id: "example--cold-iframe" },
    );
    const ready = waitForFoldkitStory(canvasElement);
    expect(host.dataset.foldkitState).toBe("mounting");
    expect(host.childNodes).toHaveLength(0);

    canvasElement.appendChild(host);

    await expect(ready).resolves.toBe(host);
    expect(host.dataset.foldkitState).toBe("ready");
    expect(host.textContent).toBe("Cold iframe: 4");
  });

  test("waits in the direct iframe realm for the original host's first commit", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDocument = iframe.contentDocument;
    expect(iframeDocument).not.toBeNull();
    if (iframeDocument === null) throw new Error("iframe document unavailable");
    const canvasElement = iframeDocument.createElement("div");
    iframeDocument.body.appendChild(canvasElement);
    const story = liveStory();
    const host = story.render(
      { count: 8, label: "Direct iframe" },
      { canvasElement, id: "example--direct-iframe" },
    );
    const ready = waitForFoldkitStory(canvasElement);

    canvasElement.appendChild(host);

    await expect(ready).resolves.toBe(host);
    expect(host.ownerDocument).toBe(iframeDocument);
    expect(host.textContent).toBe("Direct iframe: 8");
    iframe.remove();
  });

  test("destroy a pending attachment when Controls replace its story", async () => {
    const story = liveStory();
    const canvasElement = document.createElement("div");
    const abandoned = story.render(
      { count: 1, label: "Abandoned" },
      { canvasElement, id: "example--pending" },
    );
    await Promise.resolve();

    const replacement = story.render(
      { count: 2, label: "Replacement" },
      { canvasElement, id: "example--pending" },
    );
    canvasElement.appendChild(abandoned);
    await Promise.resolve();
    expect(abandoned.textContent).toBe("");

    canvasElement.replaceChildren(replacement);
    await waitForFoldkitStory(canvasElement);
    expect(canvasElement.textContent).toBe("Replacement: 2");
  });

  test("dispose the mounted runtime before a Controls remount", async () => {
    const story = liveStory();
    const canvasElement = document.createElement("div");
    const firstHost = story.render(
      { count: 1, label: "Before" },
      { canvasElement, id: "example--controls-cleanup" },
    );
    canvasElement.appendChild(firstHost);
    await waitForFoldkitStory(canvasElement);
    const staleButton = firstHost.querySelector("button");

    const replacement = story.render(
      { count: 9, label: "After" },
      { canvasElement, id: "example--controls-cleanup" },
    );
    canvasElement.replaceChildren(replacement);
    await waitForFoldkitStory(canvasElement);
    staleButton?.click();

    await Promise.resolve();
    expect(firstHost.isConnected).toBe(false);
    expect(canvasElement.textContent).toBe("After: 9");
  });

  test("reject readiness when the first FoldKit view crashes", async () => {
    const crashingStory = createFoldkitStory<Args, Model, Message>({
      ...programImpl,
      Args,
      init: (args) => [args, []],
      onCrash: () => undefined,
      view: () => {
        throw new Error("broken first view");
      },
    });
    const canvasElement = document.createElement("div");
    const host = crashingStory.render(
      { count: 1, label: "Crash" },
      { canvasElement, id: "example--crash-ready" },
    );
    canvasElement.appendChild(host);

    await expect(waitForFoldkitStory(canvasElement)).rejects.toThrow(
      "FoldKit story example--crash-ready crashed",
    );
    expect(host.dataset.foldkitState).toBe("crashed");
  });
});

describe("compatibility pins", () => {
  test("pin the exact certified dependency versions", () => {
    const root = process.cwd();
    const manifest = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
    expect(manifest).toMatchObject({
      dependencies: { effect: "4.0.0-rc.112", foldkit: "0.156.0" },
      devDependencies: {
        "@foldkit/vite-plugin": "0.20.0",
        "@storybook/html": "10.5.10",
      },
      version: "0.3.0",
    });
  });

  test("keep the runtime compatibility boundary in src/mount.ts", () => {
    const root = process.cwd();
    const found = execFileSync(
      "git",
      ["grep", "-l", "--fixed-strings", 'from "foldkit"', "--", "src/*.ts"],
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
