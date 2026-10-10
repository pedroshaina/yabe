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
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /outage\.spec\.ts/ },
    // Stops and restarts yabe-api, so it runs after everything else, on its own.
    {
      name: "outage",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /outage\.spec\.ts/,
      dependencies: ["chromium"],
    },
  ],
});
