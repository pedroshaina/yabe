import { RpcConnectionError, RpcError, RpcHttpError } from "../rpc/errors.ts";

/** bitcoind: RPC_IN_WARMUP, returned while the node is still loading. */
const RPC_IN_WARMUP = -28;
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

/** Network and pool errors Prisma 7 reports in `code` when Postgres is unreachable or overloaded. */
const TRANSIENT_DB_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "ENOTFOUND",
  "P1001",
  "P1002",
  "P1017",
  "P2024",
]);

/** SQLSTATE class 08 (connection exception) and 57P01-03 (server shutting down or restarting). */
const isConnectionSqlState = (state: string): boolean =>
  state.startsWith("08") || ["57P01", "57P02", "57P03"].includes(state);

interface PrismaKnownError {
  name: "PrismaClientKnownRequestError";
  code: string;
  meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    error instanceof Error &&
    error.name === "PrismaClientKnownRequestError" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

/**
 * Whether retrying later could succeed: the node or database is unreachable,
 * restarting or overloaded. Everything else (bugs, bad data, bad config,
 * integrity failures) is fatal and must stop the indexer.
 */
export function isTransient(error: unknown): boolean {
  if (error instanceof RpcConnectionError) return true;
  if (error instanceof RpcError) return error.code === RPC_IN_WARMUP;
  if (error instanceof RpcHttpError) return TRANSIENT_HTTP_STATUSES.has(error.status);
  if (isPrismaKnownError(error)) {
    if (TRANSIENT_DB_CODES.has(error.code)) return true;
    const state = error.meta?.driverAdapterError?.cause?.originalCode;
    return error.code === "P2039" && typeof state === "string" && isConnectionSqlState(state);
  }
  return false;
}
