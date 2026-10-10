import { expect, test, type Page } from "@playwright/test";
import { grouped, seed } from "./seed.ts";

test.use({ viewport: { width: 390, height: 844 } });

const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test("a block page fits a phone: two-row top bar, 2×2 facts, one-line hash", async ({ page }) => {
  await page.goto(`/block/${seed.bigBlock.height}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(grouped(seed.bigBlock.height));

  const brand = await page.getByRole("link", { name: "Y.A.B.E home" }).boundingBox();
  const search = await page.getByRole("search").boundingBox();
  expect(search!.y).toBeGreaterThanOrEqual(brand!.y + brand!.height);
  expect(search!.width).toBeGreaterThan(300);

  const facts = page.locator("main dl").first().locator(":scope > div");
  const [a, b, c] = await Promise.all([0, 1, 2].map((i) => facts.nth(i).boundingBox()));
  expect(b!.y).toBe(a!.y);
  expect(c!.y).toBeGreaterThan(a!.y);
  expect(c!.x).toBe(a!.x);

  const hash = await page.getByRole("button", { name: seed.bigBlock.hash }).boundingBox();
  expect(hash!.height).toBeLessThanOrEqual(34);
  expect(await scrollWidth(page)).toBe(390);
});

test("a transaction page shortens long addresses on a phone, tap to show all", async ({ page }) => {
  await page.goto(`/tx/${seed.spendTxid}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^#\d+$/);
  const address = page.locator("main ol li button[aria-expanded]").first();
  await expect(address.locator('span[aria-hidden="true"]')).toHaveText(/^bcrt1\w{5}…\w{6}$/);
  await address.click();
  await expect(address).toHaveAttribute("aria-expanded", "true");
  expect(await scrollWidth(page)).toBe(390);
});
