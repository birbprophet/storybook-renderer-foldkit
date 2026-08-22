import { defineConfig } from "vitest/config";

// Single happy-dom tier for now. Vitest BROWSER mode (real Chromium) is
// deliberately NOT configured: as of storybook-renderer-foldkit@0.1.0,
// Runtime.makeElement boots but patches nothing there — the differ crashes
// with "Cannot read properties of undefined (reading 'elm')" inside
// dedupeSharedVNodes, even for a raw text-only view with
// @foldkit/vite-plugin present (isolated probe in git history,
// "probe: raw makeElement text-only view"). Structural verification runs
// here; rendering certification happens in real Chromium at the platform's
// visual-runner phase (ADR-0021 §4), which pins its own browser build.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/*.test.ts"],
  },
});
