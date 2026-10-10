import { expect, test } from "@playwright/test";
import { grouped, seed } from "./seed.ts";

test("home lists the latest blocks and loads older ones", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator('main a[href^="/block/"]');
  await expect(cards).toHaveCount(10);
  await expect(cards.first()).toHaveAttribute("href", `/block/${seed.tip}`);
  await page.getByRole("button", { name: "Load older blocks" }).click();
  await expect(cards).toHaveCount(20);
  await expect(cards.nth(19)).toHaveAttribute("href", `/block/${seed.tip - 19}`);
});

test("home → block → every transaction → a transaction → back to its block", async ({ page }) => {
  const height = seed.bigBlock.height;
  await page.goto("/");
  await page.locator(`main a[href="/block/${height}"]`).click();
  await expect(page).toHaveURL(`/block/${height}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(grouped(height));

  const txs = page.locator('main a[href^="/tx/"]');
  await expect(txs).toHaveCount(25);
  await page.getByRole("button", { name: "Load more transactions" }).click();
  await expect(txs).toHaveCount(seed.bigBlock.txCount);
  await expect(page.getByRole("button", { name: "Load more transactions" })).toHaveCount(0);

  await page.locator(`main a[href="/tx/${seed.spendTxid}"]`).click();
  await expect(page).toHaveURL(`/tx/${seed.spendTxid}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^#\d+$/);
  await page.getByRole("link", { name: grouped(height), exact: true }).click();
  await expect(page).toHaveURL(`/block/${height}`);
});

test("the chain's ends have no dead links", async ({ page }) => {
  await page.goto(`/block/${seed.tip}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(grouped(seed.tip));
  await expect(page.getByRole("link", { name: /^Next block/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Previous block/ })).toHaveCount(1);
  await expect(page.locator("main dl div", { hasText: "Confirmations" }).locator("dd")).toHaveText(
    "1",
  );

  await page.goto("/block/0");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("0");
  await expect(page.getByRole("link", { name: /^Previous block/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Next block, 1" })).toHaveCount(1);
});
