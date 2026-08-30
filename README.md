# storybook-renderer-foldkit

A [Storybook](https://storybook.js.org) renderer for [FoldKit](https://github.com/foldkit/foldkit)
views. It mounts the real FoldKit Runtime element per story, decodes Controls
through Effect Schema, and gives Storybook a host-controlled runtime lifecycle.

Sibling to [astro-renderer-foldkit](https://github.com/birbprophet/astro-renderer-foldkit),
which fills the same gap for Astro's server surface.

## Targets

- Storybook `10.5.10`
- FoldKit `0.156.0`
- Effect `4.0.0-rc.112`
- `@foldkit/vite-plugin` `0.20.0`

The versions are exact pins. The compatibility boundary is one file
(`src/mount.ts`): it is the only code that touches both Storybook's canvas
contract and FoldKit's runtime, and its behaviour is covered by the mount
tests.

## Install from Git

This package is intentionally not published to npm. Install a known
repository commit instead of a moving branch:

```sh
npm install github:birbprophet/storybook-renderer-foldkit#<commit>
```

When upgrading, choose and review a new commit explicitly.

## Live stories

Add `foldkit()` to Storybook's Vite configuration, then create a live story:

```ts
import * as S from "effect/Schema";
import { createFoldkitStory } from "storybook-renderer-foldkit";

export const Live = {
  ...createFoldkitStory({
    Args: S.Struct({ count: S.Number }),
    Model,
    init: (args) => [args, []],
    update,
    view,
    // resources: ApiClientFixtureLive,
  }),
  args: { count: 0 },
};
```

Controls changes decode through `Args` and remount with the new initial model.
Each canvas uses the Storybook context ID for its mount seat. A remount or story
change disposes the previous FoldKit runtime before replacing it. The existing
`foldkitStories` named-fixture API remains as a compatibility wrapper.

FoldKit commits its first view asynchronously. Interaction stories must wait
for that commit before querying the canvas:

```ts
import { waitForFoldkitStory } from "storybook-renderer-foldkit";

export const Interactions = {
  ...Live,
  play: async ({ canvasElement }) => {
    await waitForFoldkitStory(canvasElement);
    // Query and operate the mounted FoldKit view here.
  },
};
```

The wait rejects when the runtime crashes and accepts an optional `AbortSignal`.
Controls changes also destroy an unmounted pending host, so a late attachment
cannot start a stale runtime.

In Storybook's `viteFinal`:

```ts
import { foldkit } from "@foldkit/vite-plugin";

viteConfig.plugins?.push(foldkit());
return viteConfig;
```

## Known limitations

- **Vitest browser mode is not used for this package's own tests.** As of
  `0.2.0`, `Runtime.makeElement` boots but patches nothing under
  Vitest browser mode + Chromium — the differ crashes with
  `Cannot read properties of undefined (reading 'elm')` inside
  `dedupeSharedVNodes`, even for a raw text-only view, with and without
  `@foldkit/vite-plugin` in the pipeline. The same mount works under
  happy-dom and (per FoldKit's examples) under real application builds.
  Structural verification therefore runs under happy-dom here; rendering
  certification belongs to a pinned-Chromium visual runner. Revisit when the
  upstream interplay is understood.

## Development

```sh
bun install   # or npm install
bun run test  # vitest under happy-dom
bun run check # tsc --noEmit
```
