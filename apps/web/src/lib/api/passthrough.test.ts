import { describe, expect, it, vi } from "vitest";
import { passthrough, type PassthroughDeps } from "@/lib/api/passthrough";

const HASH = "0000000c91d7a2e44f08b3c5a1e96d2f7b0c38e45a19f6d2c7b80e4a3f2e3b05";

function deps(fetchImpl: typeof fetch, overrides: Partial<PassthroughDeps> = {}): PassthroughDeps {
  return {
    apiUrl: "http://yabe-api:8080",
    log: { error: vi.fn() },
    fetch: fetchImpl,
    ...overrides,
  };
}

function recordingFetch(response: () => Response = () => Response.json({ ok: true })) {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(input instanceof Request ? input.url : String(input));
    return response();
  };
  return { urls, fetchImpl };
}

describe("passthrough", () => {
  it.each([
    [["status"], "http://yabe-api:8080/v1/status"],
    [["blocks"], "http://yabe-api:8080/v1/blocks"],
    [["blocks", HASH, "transactions"], `http://yabe-api:8080/v1/blocks/${HASH}/transactions`],
  ])("forwards GET %j", async (segments, expected) => {
    const { urls, fetchImpl } = recordingFetch();
    const response = await passthrough(segments, new URLSearchParams(), deps(fetchImpl));
    expect(response.status).toBe(200);
    expect(urls).toEqual([expected]);
  });

  it.each([
    [["transactions", HASH]],
    [["search"]],
    [["blocks", "318440"]],
    [["blocks", "xyz", "transactions"]],
    [["blocks", "..", "status"]],
    [["blocks/" + HASH + "/transactions", "extra"]],
    [[]],
  ])("answers %j with a 404 problem without calling the API", async (segments) => {
    const { urls, fetchImpl } = recordingFetch();
    const response = await passthrough(segments, new URLSearchParams(), deps(fetchImpl));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ status: 404, title: "Not Found" });
    expect(urls).toEqual([]);
  });

  it("forwards only limit, before and after, first value only, keeping empty values", async () => {
    const { urls, fetchImpl } = recordingFetch();
    const query = new URLSearchParams("limit=1&limit=2&before=&after=5&q=x&evil=1");
    await passthrough(["blocks"], query, deps(fetchImpl));
    const forwarded = new URL(urls[0]!).searchParams;
    expect([...forwarded]).toEqual([
      ["limit", "1"],
      ["before", ""],
      ["after", "5"],
    ]);
  });

  it("passes the API's status, body and content type through, uncached", async () => {
    const { fetchImpl } = recordingFetch(
      () =>
        new Response('{"status":400}', {
          status: 400,
          headers: { "content-type": "application/problem+json", "set-cookie": "x=1" },
        }),
    );
    const response = await passthrough(["blocks"], new URLSearchParams(), deps(fetchImpl));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe('{"status":400}');
  });

  it("passes a non-JSON 502 through unchanged and logs it", async () => {
    const log = { error: vi.fn() };
    const { fetchImpl } = recordingFetch(
      () =>
        new Response("<html>bad gateway</html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
    );
    const response = await passthrough(["status"], new URLSearchParams(), deps(fetchImpl, { log }));
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(log.error).toHaveBeenCalledOnce();
  });

  it("answers 503 when the API can't be reached, and logs it", async () => {
    const log = { error: vi.fn() };
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const response = await passthrough(["status"], new URLSearchParams(), deps(fetchImpl, { log }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ status: 503, title: "Service Unavailable" });
    expect(log.error).toHaveBeenCalledOnce();
  });

  it("answers 503 when the API is slower than the timeout", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => reject(signal.reason as Error));
      });
    const response = await passthrough(
      ["status"],
      new URLSearchParams(),
      deps(fetchImpl, { timeoutMs: 20 }),
    );
    expect(response.status).toBe(503);
  });
});
