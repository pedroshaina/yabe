import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{apps,packages}/*/src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
