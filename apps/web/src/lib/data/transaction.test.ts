import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerApi } from "@/lib/api/server";
import { loadTransaction } from "@/lib/data/transaction";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: logError }) }));

const TXID = "7c3e9f1a0b2d48e6c5a17f93d0e24b6a8f1c35d79e0b2a4c6d8e1f3a5b7c9d0e";

function client(response: () => Response | Promise<Response>) {
  const urls: string[] = [];
  const api = createServerApi("http://api:8080", async (input) => {
    urls.push(new URL(input instanceof Request ? input.url : String(input)).pathname);
    return response();
  });
  return { api, urls };
}

describe("loadTransaction", () => {
  beforeEach(() => logError.mockClear());

  it("loads the transaction", async () => {
    const { api, urls } = client(() => Response.json({ txid: TXID }));
    expect(await loadTransaction(api, TXID)).toMatchObject({ kind: "ok", data: { txid: TXID } });
    expect(urls).toEqual([`/v1/transactions/${TXID}`]);
  });

  it("is not-found for a 404, or a txid that isn't 64 hex characters (no API call)", async () => {
    const { api, urls } = client(() => Response.json({}, { status: 404 }));
    expect(await loadTransaction(api, TXID)).toEqual({ kind: "not-found" });
    expect(await loadTransaction(api, "318440")).toEqual({ kind: "not-found" });
    expect(urls).toHaveLength(1);
  });

  it("is unavailable, and logs, when the API errors or can't be reached", async () => {
    expect(
      await loadTransaction(client(() => Response.json({}, { status: 500 })).api, TXID),
    ).toEqual({ kind: "unavailable" });
    expect(
      await loadTransaction(client(() => Promise.reject(new TypeError("fetch failed"))).api, TXID),
    ).toEqual({ kind: "unavailable" });
    expect(logError).toHaveBeenCalledTimes(2);
  });
});
