import { isDatabaseUnavailable } from "@yabe/db";
import { RpcConnectionError, RpcError, RpcHttpError } from "../rpc/errors.ts";

/** bitcoind: RPC_IN_WARMUP, returned while the node is still loading. */
const RPC_IN_WARMUP = -28;
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

/**
 * Whether retrying later could succeed: the node or database is unreachable,
 * restarting, overloaded or timed out. Everything else (bugs, bad data, bad
 * config, integrity failures) is fatal and must stop the indexer.
 */
export function isTransient(error: unknown): boolean {
  if (error instanceof RpcConnectionError) return true;
  if (error instanceof RpcError) return error.code === RPC_IN_WARMUP;
  if (error instanceof RpcHttpError) return TRANSIENT_HTTP_STATUSES.has(error.status);
  return isDatabaseUnavailable(error);
}
