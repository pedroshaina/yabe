import { expect, test } from "@playwright/test";
import { grouped, seed } from "./seed.ts";

const UNKNOWN = "cd".repeat(32);
const HINT = "Enter a block height, block hash or transaction id";
const INVALID = "This isn't a valid block height, block hash or transaction id.";

test("the hero finds a block by height or hash, and a transaction by txid", async ({ page }) => {
  const block = `/block/${seed.bigBlock.height}`;
  for (const [query, url] of [
    [String(seed.bigBlock.height), block],
    [seed.bigBlock.hash.toUpperCase(), block],
    [seed.spendTxid, `/tx/${seed.spendTxid}`],
  ] as const) {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search" }).fill(query);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url);
  }
});

test("the top bar searches from inner pages", async ({ page }) => {
  await page.goto("/block/0");
  await page.getByRole("searchbox", { name: "Search" }).fill(String(seed.tip));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/block/${seed.tip}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(grouped(seed.tip));
});

test("an invalid query shows the hint and stays put", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search" }).fill("xyz");
  await page.keyboard.press("Enter");
  await expect(page.getByText(HINT)).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("unknown and invalid searches answer 404 with the not-found page", async ({ page }) => {
  const unknown = await page.goto(`/search?q=${UNKNOWN}`);
  expect(unknown?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found");
  await expect(page.getByText(UNKNOWN)).toBeVisible();
  await expect(page).toHaveTitle("Not found · Y.A.B.E");
  await expect(page.getByRole("link", { name: grouped(seed.tip), exact: true })).toHaveAttribute(
    "href",
    `/block/${seed.tip}`,
  );

  const invalid = await page.goto("/search?q=xyz");
  expect(invalid?.status()).toBe(404);
  await expect(page.getByText(INVALID)).toBeVisible();
});

test("unknown block and transaction ids show the not-found page, titled so", async ({ page }) => {
  for (const path of ["/block/9999999999", `/block/${UNKNOWN}`, `/tx/${UNKNOWN}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Not found");
    await expect(page).toHaveTitle("Not found · Y.A.B.E");
  }
});
