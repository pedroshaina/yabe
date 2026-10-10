import "server-only";
import { getConfig } from "@/config";
import { TIP_HINT_TIMEOUT_MS } from "@/lib/api/constants";
import { createServerApi, type ServerApi } from "@/lib/api/server";
import { getLogger } from "@/lib/logger";

/** The latest indexed height, or null when there is none or the API can't say. Never throws. */
export async function loadTipHeight(api: ServerApi): Promise<number | null> {
  try {
    const { data, response } = await api.GET("/v1/status");
    if (data) return data.tip?.height ?? null;
    getLogger().error({ status: response.status }, "the API answered /v1/status with an error");
  } catch (error) {
    getLogger().error({ err: error }, "could not load the chain tip");
  }
  return null;
}

/** For the not-found page's height hint: gives up after 2 s, because the page is useful without it. */
export function getHintTipHeight(): Promise<number | null> {
  return loadTipHeight(createServerApi(getConfig().apiUrl, fetch, TIP_HINT_TIMEOUT_MS));
}
