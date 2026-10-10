import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./axe.ts";
import { grouped, seed } from "./seed.ts";

const pages: { name: string; path: string; ready: (page: Page) => Promise<void> }[] = [
  {
    name: "home",
    path: "/",
    ready: (page) => expect(page.locator('main a[href^="/block/"]')).toHaveCount(10),
  },
  {
    name: "block",
    path: `/block/${seed.bigBlock.height}`,
    ready: async (page) => {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        grouped(seed.bigBlock.height),
      );
      await page.getByText("Technical details").click();
    },
  },
  {
    name: "transaction",
    path: `/tx/${seed.spendTxid}`,
    ready: async (page) => {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^#\d+$/);
      await page.getByText("Technical details").click();
      await page.getByRole("button", { name: "Show asm" }).click();
    },
  },
  {
    name: "not found",
    path: "/nope",
    ready: (page) => expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found"),
  },
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "yabe-theme", value: theme, url: baseURL! }]);
    });

    for (const { name, path, ready } of pages) {
      test(`${name} has no accessibility violations`, async ({ page }) => {
        await page.goto(path);
        await ready(page);
        await expectNoA11yViolations(page);
      });
    }
  });
}
