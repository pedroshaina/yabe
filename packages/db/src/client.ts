import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

export interface PrismaClientOptions {
  /** Give up connecting after this long (default 10 s), instead of hanging on an unresponsive host. */
  connectionTimeoutMs?: number;
  /** Give up on a query with no response after this long (default 120 s). */
  queryTimeoutMs?: number;
}

export function createPrismaClient(
  databaseUrl: string,
  options: PrismaClientOptions = {},
): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis: options.connectionTimeoutMs ?? 10_000,
      query_timeout: options.queryTimeoutMs ?? 120_000,
      // Detect half-open connections (e.g. a host that vanished) via TCP keepalive.
      keepAlive: true,
    }),
  });
}

export { PrismaClient };
