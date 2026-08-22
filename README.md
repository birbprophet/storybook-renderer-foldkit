# storybook-renderer-foldkit

A [Storybook](https://storybook.js.org) renderer for [Foldkit](https://github.com/foldkit/foldkit)
views. It mounts the real Foldkit Runtime element per story — the shipped
boundary, not a serialization of it — and turns named fixture Models into
static CSF stories.

Sibling to [astro-renderer-foldkit](https://github.com/birbprophet/astro-renderer-foldkit),
which fills the same gap for Astro's server surface.

## Targets

- Storybook `10.5.10`
- FoldKit `0.148.2`
- Effect `4.0.0-rc.110`

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

## Use

In `preview.ts`, nothing special is required — stories carry their own
`render`. In a stories file:

```ts
// Counter.stories.ts
import { foldkitStories } from "storybook-renderer-foldkit";

import * as program from "../src/main.ts"; // Model, update, view
import { live, loading } from "../src/stories.ts"; // named fixture Models

const stories = foldkitStories({
  title: "Trade/Chain",
  program,
  // resources: ApiClientFixtureLive, // optional Layer
});
## Known limitations

- **Vitest browser mode is not used for this package's own tests.** As of
  `0.1.0`, `Runtime.makeElement` boots but patches nothing under
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
