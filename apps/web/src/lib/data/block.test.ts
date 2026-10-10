import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerApi } from "@/lib/api/server";
import { loadBlock } from "@/lib/data/block";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: logError }) }));

const HASH = "0000000c91d7a2e44f08b3c5a1e96d2f7b0c38e45a19f6d2c7b80e4a3f2e3b05";
const block = {
  height: 318440,
  hash: HASH,
  prevHash: "1".repeat(64),
  nextBlockHash: null,
  confirmations: 1,
  merkleRoot: "2".repeat(64),
  version: 0x20000000,
  bits: "1e0377ae",
  nonce: 2184391,
  difficulty: 0.0026,
  time: 1_791_590_000,
  medianTime: 1_791_587_000,
  size: 501_000,
  strippedSize: 388_000,
  weight: 2_000_000,
  txCount: 1431,
  subsidySat: 312_500_000,
  totalFeeSat: 221_005,
  rewardSat: 312_721_005,
};
const txPage = { transactions: [], next: null };

type Route = (url: URL) => Response;
function api(route: Route) {
  const urls: string[] = [];
  const client = createServerApi("http://api:8080", async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    urls.push(url.pathname + url.search);
    return route(url);
  });
  return { client, urls };
}

describe("loadBlock", () => {
  beforeEach(() => logError.mockClear());

  it("loads the block, then its first page of transactions by hash", async () => {
    const { client, urls } = api((url) =>
      url.pathname.endsWith("/transactions") ? Response.json(txPage) : Response.json(block),
    );
    const result = await loadBlock(client, "318440");
    expect(result).toMatchObject({ kind: "ok", data: { block, transactions: txPage } });
    expect(urls).toEqual(["/v1/blocks/318440", `/v1/blocks/${HASH}/transactions?limit=25`]);
  });

  it.each([[404], [400]])("is not-found when the API answers %d", async (status) => {
    const { client, urls } = api(() => Response.json({ status }, { status }));
    expect(await loadBlock(client, "9999999999")).toEqual({ kind: "not-found" });
    expect(urls).toHaveLength(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("is unavailable, and logs, when the API errors or can't be reached", async () => {
    const { client } = api(() => Response.json({ status: 503 }, { status: 503 }));
    expect(await loadBlock(client, "1")).toEqual({ kind: "unavailable" });
    const unreachable = createServerApi("http://api:8080", async () => {
      throw new TypeError("fetch failed");
    });
    expect(await loadBlock(unreachable, "1")).toEqual({ kind: "unavailable" });
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it("is unavailable when the transactions request fails", async () => {
    const { client } = api((url) =>
      url.pathname.endsWith("/transactions")
        ? Response.json({}, { status: 503 })
        : Response.json(block),
    );
    expect(await loadBlock(client, "318440")).toEqual({ kind: "unavailable" });
  });

  it("is not-found for an id that can't be a height or hash, without calling the API", async () => {
    const { client, urls } = api(() => Response.json(block));
    expect(await loadBlock(client, "xyz")).toEqual({ kind: "not-found" });
    expect(urls).toEqual([]);
  });
});
