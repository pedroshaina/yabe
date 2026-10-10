import "server-only";
import { cache } from "react";
import { serverApi, type ServerApi } from "@/lib/api/server";
import type { Transaction } from "@/lib/api/types";
import { isTxid } from "@/lib/ids";
import { getLogger } from "@/lib/logger";
import type { Loaded } from "./block";

const NOT_FOUND = new Set([400, 404]);

export async function loadTransaction(api: ServerApi, txid: string): Promise<Loaded<Transaction>> {
  if (!isTxid(txid)) return { kind: "not-found" };
  try {
    const { data, response } = await api.GET("/v1/transactions/{txid}", {
      params: { path: { txid } },
    });
    if (data) return { kind: "ok", data, now: Date.now() };
    if (NOT_FOUND.has(response.status)) return { kind: "not-found" };
    getLogger().error(
      { status: response.status, txid },
      "the API answered a transaction request with an error",
    );
    return { kind: "unavailable" };
  } catch (error) {
    getLogger().error({ err: error, txid }, "could not load a transaction");
    return { kind: "unavailable" };
  }
}

export const getTransaction = cache((txid: string) => loadTransaction(serverApi(), txid));
