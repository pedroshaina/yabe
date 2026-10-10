import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const webSrc = path.resolve(import.meta.dirname, "apps/web/src");

export default defineConfig({
  // Resolve workspace packages to their TypeScript sources (see the "source" export condition).
  ssr: {
    resolve: {
      conditions: ["source"],
    },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 180_000,
    projects: [
      {
        extends: true,
        test: {
          name: "backend",
          include: ["{apps,packages}/*/src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "apps/web/**"],
        },
      },
      {
        extends: true,
        resolve: { alias: { "@": webSrc } },
        test: { name: "web", include: ["apps/web/src/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        plugins: [react()],
        resolve: { alias: { "@": webSrc } },
        test: {
          name: "web-dom",
          include: ["apps/web/src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["apps/web/vitest.setup.ts"],
        },
      },
    ],
  },
});
