import { describe, expect, it } from "vitest";
import { RpcConnectionError, RpcError, RpcHttpError, RpcResponseError } from "../rpc/errors.ts";
import { InvalidBlockDataError } from "../sync/transform.ts";
import { RetriesExhaustedError, withRetry } from "./retry.ts";
import { isTransient } from "./transient.ts";

/** Shapes captured from Prisma 7.10 with @prisma/adapter-pg while planning. */
const prismaError = (code: string, meta?: unknown) =>
  Object.assign(new Error(`prisma ${code}`), { name: "PrismaClientKnownRequestError", code, meta });
const adapterError = (sqlState: string) =>
  prismaError("P2039", {
    modelName: "Block",
    driverAdapterError: { name: "DriverAdapterError", cause: { originalCode: sqlState } },
  });
const unreachable = () =>
  new RpcConnectionError("getblockcount", "http://127.0.0.1:1", {
    cause: new Error("ECONNREFUSED"),
  });

describe("isTransient", () => {
  it.each([
    ["node unreachable", unreachable()],
    ["node warming up (-28)", new RpcError("getblockchaininfo", -28, "Loading block index…")],
    ["node work queue full (503)", new RpcHttpError("getblock", 503)],
    ["database unreachable", prismaError("ECONNREFUSED")],
    ["database connection reset", prismaError("ECONNRESET")],
    ["database connection killed (57P01)", adapterError("57P01")],
    ["database connection failure (08006)", adapterError("08006")],
    ["database pool timeout (P2024)", prismaError("P2024")],
  ])("%s is transient", (_label, error) => {
    expect(isTransient(error)).toBe(true);
  });

  it.each([
    ["node error -8", new RpcError("getblockhash", -8, "Block height out of range")],
    ["wrong credentials (401)", new RpcHttpError("getblockcount", 401)],
    ["unexpected node response", new RpcResponseError("getblock", "bad shape")],
    ["invalid block data", new InvalidBlockDataError("no fee")],
    ["unique violation (P2002)", prismaError("P2002")],
    ["interactive transaction timeout (P2028)", prismaError("P2028")],
    ["constraint error via the adapter (23505)", adapterError("23505")],
    ["plain error", new Error("boom")],
    ["non-error value", "boom"],
  ])("%s is fatal", (_label, error) => {
    expect(isTransient(error)).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries transient failures with exponential backoff until it succeeds", async () => {
    let calls = 0;
    const delays: number[] = [];

    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 4) throw unreachable();
        return "ok";
      },
      {
        isTransient,
        backoff: { initialDelayMs: 1, maxDelayMs: 3 },
        random: () => 1,
        onRetry: (_error, _attempt, delayMs) => delays.push(delayMs),
      },
    );

    expect(result).toBe("ok");
    expect(calls).toBe(4);
    expect(delays).toEqual([1, 2, 3]);
  });

  it("applies jitter between 50% and 100% of the backoff delay", async () => {
    const delays: number[] = [];
    let calls = 0;

    await withRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw unreachable();
      },
      {
        isTransient,
        backoff: { initialDelayMs: 10, maxDelayMs: 100 },
        random: () => 0,
        onRetry: (_error, _attempt, delayMs) => delays.push(delayMs),
      },
    );

    expect(delays).toEqual([5]);
  });

  it("rethrows a fatal error immediately", async () => {
    let calls = 0;

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new InvalidBlockDataError("no fee");
        },
        { isTransient, backoff: { initialDelayMs: 1, maxDelayMs: 1 } },
      ),
    ).rejects.toBeInstanceOf(InvalidBlockDataError);
    expect(calls).toBe(1);
  });

  it("rethrows the last transient error when aborted while waiting", async () => {
    const controller = new AbortController();
    const started = Date.now();

    await expect(
      withRetry(
        async () => {
          throw unreachable();
        },
        {
          isTransient,
          signal: controller.signal,
          backoff: { initialDelayMs: 60_000, maxDelayMs: 60_000 },
          onRetry: () => controller.abort(),
        },
      ),
    ).rejects.toBeInstanceOf(RpcConnectionError);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("gives up after maxRetries and keeps the last error as the cause", async () => {
    let calls = 0;
    const last = unreachable();

    const error = await withRetry(
      async () => {
        calls += 1;
        throw last;
      },
      { isTransient, maxRetries: 3, backoff: { initialDelayMs: 1, maxDelayMs: 1 } },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RetriesExhaustedError);
    expect(error).toMatchObject({ attempts: 4, cause: last });
    expect(String(error)).toMatch(/4 attempts/);
    expect(calls).toBe(4);
  });

  it("is not itself transient, so a caller's retry loop stops", () => {
    expect(isTransient(new RetriesExhaustedError(11, { cause: unreachable() }))).toBe(false);
  });

  it("does not retry once already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw unreachable();
        },
        { isTransient, signal: controller.signal, backoff: { initialDelayMs: 1, maxDelayMs: 1 } },
      ),
    ).rejects.toBeInstanceOf(RpcConnectionError);
    expect(calls).toBe(1);
  });
});
