import { expect, test } from "@playwright/test";
import { API_URL } from "../stack/urls.ts";
import { seed } from "./seed.ts";

test.use({ baseURL: API_URL });

test("the API is ready and serves the seeded tip", async ({ request }) => {
  expect(await (await request.get("/ready")).json()).toMatchObject({ status: "ok" });
  const page = (await (await request.get("/v1/blocks?limit=1")).json()) as {
    blocks: { height: number }[];
  };
  expect(page.blocks[0]?.height).toBe(seed.tip);
});

test("the API serves a real spend, and finds it by txid", async ({ request }) => {
  const tx = (await (await request.get(`/v1/transactions/${seed.spendTxid}`)).json()) as {
    isCoinbase: boolean;
    feeSat: number;
    confirmations: number;
    inputs: { valueSat: number }[];
  };
  expect(tx.isCoinbase).toBe(false);
  expect(tx.feeSat).toBeGreaterThan(0);
  expect(tx.inputs[0]?.valueSat).toBeGreaterThan(0);
  expect(tx.confirmations).toBe(seed.tip - seed.bigBlock.height + 1);
  const found = (await (await request.get(`/v1/search?q=${seed.spendTxid}`)).json()) as unknown;
  expect(found).toEqual({ type: "transaction", txid: seed.spendTxid });
});
