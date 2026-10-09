import { RpcConnectionError, RpcError, RpcHttpError } from "../rpc/errors.ts";

/** bitcoind: RPC_IN_WARMUP, returned while the node is still loading. */
const RPC_IN_WARMUP = -28;
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

/**
 * Prisma codes for an unreachable, closed or saturated database
 * (P1001 can't reach, P1002/P1008 timeouts, P1017 closed, P2024 pool timeout).
 * Socket codes are kept for errors that carry them directly.
 */
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
  "P1008",
  "P1017",
  "P2024",
]);

/** @prisma/adapter-pg error kinds for connection failures. */
const TRANSIENT_ADAPTER_KINDS = new Set([
  "ConnectionClosed",
  "DatabaseNotReachable",
  "SocketTimeout",
]);

/** SQLSTATE class 08 (connection exception) and 57P01-03 (server shutting down or restarting). */
const isConnectionSqlState = (state: string): boolean =>
  state.startsWith("08") || ["57P01", "57P02", "57P03"].includes(state);

/**
 * pg's own errors for a dead, closed or timed-out connection. pg sets no `code`
 * on these, and the adapter re-throws them unwrapped, so the message is the
 * only signal. Anchored, so unrelated messages never match.
 */
const PG_CONNECTION_FAILURE =
  /^(Connection terminated( unexpectedly| due to connection timeout)?|Client has encountered a connection error and is not queryable|timeout exceeded when trying to connect|Query read timeout)$/;

/** Prisma could not get a connection to start the interactive transaction in time. */
const TRANSACTION_START_TIMEOUT = /Unable to start a transaction in the given time/;

/** The adapter's error, found directly or as `meta.driverAdapterError` on a Prisma error. */
interface AdapterCause {
  kind?: unknown;
  originalCode?: unknown;
}

function isTransientAdapterCause(cause: AdapterCause | undefined): boolean {
  if (!cause) return false;
  if (typeof cause.kind === "string" && TRANSIENT_ADAPTER_KINDS.has(cause.kind)) return true;
  return typeof cause.originalCode === "string" && isConnectionSqlState(cause.originalCode);
}

function adapterCauseOf(error: Error): AdapterCause | undefined {
  if (error.name === "DriverAdapterError") {
    return error.cause as AdapterCause | undefined;
  }
  if (error.name === "PrismaClientKnownRequestError") {
    const meta = (error as { meta?: { driverAdapterError?: { cause?: AdapterCause } } }).meta;
    return meta?.driverAdapterError?.cause;
  }
  return undefined;
}

/**
 * Whether retrying later could succeed: the node or database is unreachable,
 * restarting, overloaded or timed out. Everything else (bugs, bad data, bad
 * config, integrity failures) is fatal and must stop the indexer.
 *
 * Prisma 7 + adapter-pg surface one database failure in several shapes,
 * depending on where it hits: a model query (P1001/P1017/P2039), a raw or
 * TypedSQL query (P2010), a transaction boundary (bare DriverAdapterError or
 * pg's own error). db-errors.test.ts pins them against a real Postgres.
 */
export function isTransient(error: unknown): boolean {
  if (error instanceof RpcConnectionError) return true;
  if (error instanceof RpcError) return error.code === RPC_IN_WARMUP;
  if (error instanceof RpcHttpError) return TRANSIENT_HTTP_STATUSES.has(error.status);
  if (!(error instanceof Error)) return false;

  if (PG_CONNECTION_FAILURE.test(error.message)) return true;
  if (isTransientAdapterCause(adapterCauseOf(error))) return true;

  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return false;
  if (TRANSIENT_DB_CODES.has(code)) return true;
  return code === "P2028" && TRANSACTION_START_TIMEOUT.test(error.message);
}
