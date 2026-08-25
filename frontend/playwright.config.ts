import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression harness.
 *
 * Baselines are captured from the build that renders the client's original view
 * code. Every screen ported to JSX must reproduce its baseline pixel for pixel
 * before the old view file is deleted.
 */
export default defineConfig({
  testDir: "./visual",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "visual/report" }]],
  snapshotPathTemplate: "visual/baselines/{arg}{ext}",
  timeout: 90_000,

  expect: {
    toHaveScreenshot: {
      // A handful of stray antialiased pixels must not fail a port, but any
      // real layout, spacing or colour change will exceed this immediately.
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
      scale: "css",
    },
  },

  use: {
    // Spread first: a fixed viewport and scale are what make screenshots
    // comparable, so they must win over the device preset.
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${process.env.VISUAL_PORT || 3100}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },

  webServer: {
    command: "node visual/serve.mjs",
    url: `http://127.0.0.1:${process.env.VISUAL_PORT || 3100}/till/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
