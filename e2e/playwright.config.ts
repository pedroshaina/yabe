import { defineConfig, devices } from "@playwright/test";
import { WEB_URL } from "./stack/urls.ts";

export default defineConfig({
  testDir: "tests",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: WEB_URL, trace: "retain-on-failure" },
  projects: [
    // Read-only specs: safe in parallel against one shared stack.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /(outage|contract)\.spec\.ts/,
    },
    // Stops and restarts yabe-api, so it runs after everything else, on its own.
    {
      name: "outage",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /outage\.spec\.ts/,
      dependencies: ["chromium"],
    },
    // Stops and restarts the indexer and the API: after the outage spec, never alongside it.
    {
      name: "contract",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /contract\.spec\.ts/,
      dependencies: ["outage"],
    },
  ],
});
