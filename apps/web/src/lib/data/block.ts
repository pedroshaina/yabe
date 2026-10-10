import "server-only";
import { cache } from "react";
import { serverApi, type ServerApi } from "@/lib/api/server";
import type { Block, TxPage } from "@/lib/api/types";
import { isBlockId } from "@/lib/ids";
import { getLogger } from "@/lib/logger";
import { TX_PAGE_SIZE } from "@/lib/api/constants";

export type Loaded<T> =
  { kind: "ok"; data: T; now: number } | { kind: "not-found" } | { kind: "unavailable" };

/** 400 and 404 both mean "no such block": the id passed our check but the API rejects or can't find it. */
const NOT_FOUND = new Set([400, 404]);

export async function loadBlock(
  api: ServerApi,
  id: string,
): Promise<Loaded<{ block: Block; transactions: TxPage }>> {
  if (!isBlockId(id)) return { kind: "not-found" };
  try {
    const blockResult = await api.GET("/v1/blocks/{hashOrHeight}", {
      params: { path: { hashOrHeight: id } },
    });
    if (!blockResult.data) {
      if (NOT_FOUND.has(blockResult.response.status)) return { kind: "not-found" };
      getLogger().error(
        { status: blockResult.response.status, id },
        "the API answered a block request with an error",
      );
      return { kind: "unavailable" };
    }
    const block = blockResult.data;
    const txResult = await api.GET("/v1/blocks/{hash}/transactions", {
      params: { path: { hash: block.hash }, query: { limit: String(TX_PAGE_SIZE) } },
    });
    if (!txResult.data) {
      getLogger().error(
        { status: txResult.response.status, hash: block.hash },
        "the API answered a block transactions request with an error",
      );
      return { kind: "unavailable" };
    }
    return { kind: "ok", data: { block, transactions: txResult.data }, now: Date.now() };
  } catch (error) {
    getLogger().error({ err: error, id }, "could not load a block");
    return { kind: "unavailable" };
  }
}

/** One API round trip per request, shared by generateMetadata and the page. */
export const getBlock = cache((id: string) => loadBlock(serverApi(), id));
