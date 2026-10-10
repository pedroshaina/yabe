import "server-only";
import createClient from "openapi-fetch";
import { getConfig } from "@/config";
import { API_TIMEOUT_MS } from "./constants";
import type { paths } from "./schema";

/** A typed yabe-api client. Every request is aborted after `timeoutMs`. */
export function createServerApi(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = API_TIMEOUT_MS,
) {
  return createClient<paths>({
    baseUrl,
    fetch: (request) =>
      fetchImpl(request, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]),
      }),
  });
}

let api: ReturnType<typeof createServerApi> | undefined;

/** The server's client for yabe-api at WEB_API_URL. Server-only. */
export function serverApi(): ReturnType<typeof createServerApi> {
  api ??= createServerApi(getConfig().apiUrl);
  return api;
}
