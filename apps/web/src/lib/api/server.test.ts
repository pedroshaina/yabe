import { describe, expect, it } from "vitest";
import { createServerApi } from "@/lib/api/server";

const tipBody = { tip: { height: 318442, hash: "00".repeat(32), time: 1_791_590_000 } };
const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

describe("createServerApi", () => {
  it("calls the API at the configured origin and returns typed data", async () => {
    const urls: string[] = [];
    const api = createServerApi("http://yabe-api:8080", async (input) => {
      urls.push(urlOf(input));
      return Response.json(tipBody);
    });

    const { data } = await api.GET("/v1/status");

    expect(urls).toEqual(["http://yabe-api:8080/v1/status"]);
    expect(data?.tip?.height).toBe(318442);
  });

  it("passes path and query parameters", async () => {
    const urls: string[] = [];
    const api = createServerApi("http://a:1", async (input) => {
      urls.push(urlOf(input));
      return Response.json({ blocks: [], next: null });
    });

    await api.GET("/v1/blocks", { params: { query: { limit: "10", before: "318432" } } });

    expect(urls).toEqual(["http://a:1/v1/blocks?limit=10&before=318432"]);
  });

  it("aborts a request that takes longer than the timeout", async () => {
    const api = createServerApi(
      "http://a:1",
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => reject(signal.reason as Error));
        }),
      20,
    );

    await expect(api.GET("/v1/status")).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
