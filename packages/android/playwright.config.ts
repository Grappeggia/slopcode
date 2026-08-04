import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./visual",
  outputDir: ".playwright-results",
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: "line",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002,
      threshold: 0.1,
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
  },
  webServer: {
    command: "bunx vite --host 127.0.0.1 --port 41743 --strictPort",
    url: "http://127.0.0.1:41743/ssh-agentic-session-dom-fixture.html",
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
