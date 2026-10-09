import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve workspace packages to their TypeScript sources (see the "source" export condition).
  ssr: {
    resolve: {
      conditions: ["source"],
    },
  },
  test: {
    include: ["{apps,packages}/*/src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
