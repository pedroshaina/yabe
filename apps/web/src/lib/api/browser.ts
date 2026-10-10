import createClient from "openapi-fetch";
import type { paths } from "./schema";
import type { BlocksPage, Tip } from "./types";

/** yabe-api answered with a non-2xx status (through the passthrough route). */
export class ApiError extends Error {
  override name = "ApiError";
  constructor(readonly status: number) {
    super(`the API answered with status ${status}`);
  }
}

/**
 * Browser-side client for the passthrough route at /api/v1/... An absolute base URL keeps
 * Request() happy outside real browsers; the fetch wrapper resolves globalThis.fetch per call.
 */
function client() {
  return createClient<paths>({
    baseUrl: `${window.location.origin}/api`,
    fetch: (request) => globalThis.fetch(request),
  });
}

export async function fetchBlocks(params: { limit: number; before?: number }): Promise<BlocksPage> {
  const query =
    params.before === undefined
      ? { limit: String(params.limit) }
      : { limit: String(params.limit), before: String(params.before) };
  const { data, response } = await client().GET("/v1/blocks", { params: { query } });
  if (!data) throw new ApiError(response.status);
  return data;
}

export async function fetchTip(): Promise<Tip | null> {
  const { data, response } = await client().GET("/v1/status");
  if (!data) throw new ApiError(response.status);
  return data.tip;
}
