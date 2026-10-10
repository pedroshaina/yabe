import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerApi } from "@/lib/api/server";
import { loadSearch } from "@/lib/data/search";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: logError }) }));

const HASH = "0000000a3260c7cc3a6d04ef6d1b044023645ca6d8cb134070da9e01b7939141";

function api(response: () => Response | Promise<Response>) {
  const urls: string[] = [];
  const client = createServerApi("http://api:8080", async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    urls.push(url.pathname + url.search);
    return response();
  });
  return { client, urls };
}

describe("loadSearch", () => {
  beforeEach(() => logError.mockClear());

  it("finds a block by its trimmed query", async () => {
    const { client, urls } = api(() =>
      Response.json({ type: "block", hash: HASH, height: 325700 }),
    );
    expect(await loadSearch(client, `  ${HASH.toUpperCase()} `)).toEqual({
      kind: "block",
      height: 325700,
    });
    expect(urls).toEqual([`/v1/search?q=${HASH.toUpperCase()}`]);
  });

  it("finds a transaction", async () => {
    const { client } = api(() => Response.json({ type: "transaction", txid: HASH }));
    expect(await loadSearch(client, HASH)).toEqual({ kind: "transaction", txid: HASH });
  });

  it.each([[404], [400]])(
    "is not-found when the API answers %d, without logging",
    async (status) => {
      const { client } = api(() => Response.json({ status }, { status }));
      expect(await loadSearch(client, "9999999999")).toEqual({ kind: "not-found" });
      expect(logError).not.toHaveBeenCalled();
    },
  );

  it.each([[""], ["   "], ["xyz"], ["12345678901"]])(
    "is not-found for %j without calling the API",
    async (raw) => {
      const { client, urls } = api(() => Response.json({}));
      expect(await loadSearch(client, raw)).toEqual({ kind: "not-found" });
      expect(urls).toEqual([]);
    },
  );

  it("is unavailable, and logs, when the API errors or can't be reached", async () => {
    expect(await loadSearch(api(() => Response.json({}, { status: 503 })).client, "1")).toEqual({
      kind: "unavailable",
    });
    expect(
      await loadSearch(api(() => Promise.reject(new TypeError("fetch failed"))).client, "1"),
    ).toEqual({ kind: "unavailable" });
    expect(logError).toHaveBeenCalledTimes(2);
  });
});
