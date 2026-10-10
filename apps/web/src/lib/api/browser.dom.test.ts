import { describe, expect, it, vi } from "vitest";
import { ApiError, fetchBlocks, fetchTip } from "@/lib/api/browser";

const block = {
  height: 318442,
  hash: "0".repeat(64),
  time: 1_791_590_000,
  txCount: 1204,
  size: 412_000,
  weight: 1_640_000,
  totalFeeSat: 182_340,
};

function stubFetch(response: () => Response) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(input instanceof Request ? input.url : String(input));
      return response();
    }),
  );
  return urls;
}

describe("browser API client", () => {
  it("fetches a page of blocks through the passthrough route", async () => {
    const urls = stubFetch(() => Response.json({ blocks: [block], next: 318441 }));
    await expect(fetchBlocks({ limit: 10, before: 318442 })).resolves.toEqual({
      blocks: [block],
      next: 318441,
    });
    expect(urls).toEqual([`${location.origin}/api/v1/blocks?limit=10&before=318442`]);
  });

  it("omits the cursor for the first page", async () => {
    const urls = stubFetch(() => Response.json({ blocks: [], next: null }));
    await fetchBlocks({ limit: 10 });
    expect(urls).toEqual([`${location.origin}/api/v1/blocks?limit=10`]);
  });

  it("returns the tip, or null when nothing is indexed", async () => {
    stubFetch(() => Response.json({ tip: { height: 5, hash: "a".repeat(64), time: 1 } }));
    await expect(fetchTip()).resolves.toEqual({ height: 5, hash: "a".repeat(64), time: 1 });
    stubFetch(() => Response.json({ tip: null }));
    await expect(fetchTip()).resolves.toBeNull();
  });

  it("throws ApiError with the status when the API answers with an error", async () => {
    stubFetch(() => Response.json({ status: 503 }, { status: 503 }));
    await expect(fetchBlocks({ limit: 10 })).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
    });
    await expect(fetchTip()).rejects.toBeInstanceOf(ApiError);
  });

  it("lets network errors through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await expect(fetchTip()).rejects.toBeInstanceOf(TypeError);
  });
});
