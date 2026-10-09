import { createServer, type Server, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isDatabaseUnavailable } from "./connection.ts";
import { createPrismaClient, sql, type PrismaClient } from "./index.ts";
import { startTestDatabase, type TestDatabase } from "./testing/database.ts";

/**
 * Real connection failures from Prisma 7 + @prisma/adapter-pg against Postgres,
 * not hand-built shapes: each surfaces differently depending on whether it hits
 * a model query, a raw (TypedSQL) query or a transaction boundary.
 */
describe("database connection failures are detected as unavailable", () => {
  let db: TestDatabase;
  let superuser: PrismaClient;

  beforeAll(async () => {
    db = await startTestDatabase();
    superuser = createPrismaClient(db.superuserUrl);
  });

  afterAll(async () => {
    await superuser?.$disconnect();
    await db?.stop();
  });

  /** Runs `fn`, which must fail, and returns what it threw with its classification. */
  async function failure(fn: () => Promise<unknown>) {
    const error = await fn().then(
      () => new Error("expected a failure"),
      (e: unknown) => e,
    );
    const { name, code, message } = error as { name?: string; code?: unknown; message?: string };
    return {
      name,
      code,
      message: message?.split("\n").filter(Boolean).pop(),
      transient: isDatabaseUnavailable(error),
    };
  }

  const terminateIndexerSessions = () =>
    superuser.$executeRawUnsafe(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'yabe_indexer'",
    );

  it("a refused connection, for raw, model and transaction queries", async () => {
    const prisma = createPrismaClient("postgresql://yabe_indexer:x@127.0.0.1:1/yabe");
    try {
      expect(await failure(() => prisma.$queryRawTyped(sql.selectTip()))).toMatchObject({
        transient: true,
      });
      expect(await failure(() => prisma.block.count())).toMatchObject({ transient: true });
      expect(await failure(() => prisma.$transaction((tx) => tx.block.count()))).toMatchObject({
        transient: true,
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("a session killed during a raw query", async () => {
    const prisma = createPrismaClient(db.indexerUrl);
    try {
      const running = failure(() => prisma.$queryRawUnsafe("SELECT pg_sleep(10)"));
      await expect
        .poll(
          async () =>
            (
              await superuser.$queryRawUnsafe<{ n: number }[]>(
                "SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = 'yabe_indexer' AND query LIKE '%pg_sleep%' AND state = 'active'",
              )
            )[0]?.n,
          { timeout: 5_000 },
        )
        .toBe(1);
      await terminateIndexerSessions();

      expect(await running).toMatchObject({ transient: true });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("a session killed between statements of a transaction", async () => {
    const prisma = createPrismaClient(db.indexerUrl);
    try {
      const result = await failure(() =>
        prisma.$transaction(async (tx) => {
          await tx.block.count();
          await terminateIndexerSessions();
          await tx.block.count();
        }),
      );

      expect(result).toMatchObject({ transient: true });
    } finally {
      await prisma.$disconnect();
    }
  });

  describe("an unresponsive database", () => {
    let blackHole: Server;
    const sockets = new Set<Socket>();
    let url: string;

    beforeAll(async () => {
      // Accepts TCP connections and never answers, like a half-open or black-holed host.
      blackHole = createServer((socket) => sockets.add(socket));
      await new Promise<void>((resolve) => blackHole.listen(0, "127.0.0.1", resolve));
      url = `postgresql://yabe_indexer:x@127.0.0.1:${(blackHole.address() as AddressInfo).port}/yabe`;
    });

    afterAll(() => {
      for (const socket of sockets) socket.destroy();
      blackHole?.close();
    });

    it("fails within the connection timeout, as a transient error, instead of hanging", async () => {
      const prisma = createPrismaClient(url, { connectionTimeoutMs: 500 });
      try {
        const started = Date.now();
        expect(await failure(() => prisma.$queryRawTyped(sql.selectTip()))).toMatchObject({
          transient: true,
        });
        expect(await failure(() => prisma.$transaction((tx) => tx.block.count()))).toMatchObject({
          transient: true,
        });
        expect(Date.now() - started).toBeLessThan(10_000);
      } finally {
        await prisma.$disconnect();
      }
    });
  });
});
