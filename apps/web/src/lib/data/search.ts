import "server-only";
import type { ServerApi } from "@/lib/api/server";
import { getLogger } from "@/lib/logger";
import { classifyQuery } from "@/lib/search";

export type SearchOutcome =
  | { kind: "block"; height: number }
  | { kind: "transaction"; txid: string }
  | { kind: "not-found" }
  | { kind: "unavailable" };

/** 400 (the API rejects the query) and 404 (nothing matches) both end on the not-found page. */
const NOT_FOUND = new Set([400, 404]);

export async function loadSearch(api: ServerApi, raw: string): Promise<SearchOutcome> {
  const query = classifyQuery(raw);
  if (query.kind === "invalid") return { kind: "not-found" };
  try {
    const { data, response } = await api.GET("/v1/search", {
      params: { query: { q: query.value } },
    });
    if (data) {
      return data.type === "block"
        ? { kind: "block", height: data.height }
        : { kind: "transaction", txid: data.txid };
    }
    if (NOT_FOUND.has(response.status)) return { kind: "not-found" };
    getLogger().error(
      { status: response.status, q: query.value },
      "the API answered a search with an error",
    );
    return { kind: "unavailable" };
  } catch (error) {
    getLogger().error({ err: error, q: query.value }, "could not search");
    return { kind: "unavailable" };
  }
}
