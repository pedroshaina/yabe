import { z } from "zod";
import { NETWORKS, type Network } from "./chain/network.ts";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const envSchema = z.object({
  INDEXER_DATABASE_URL: z.url(),
  INDEXER_BITCOIN_NETWORK: z.enum(NETWORKS),
  INDEXER_BITCOIN_RPC_URL: z.url().refine((value) => {
    const url = new URL(value);
    return url.username === "" && url.password === "";
  }, "must not contain credentials; use INDEXER_BITCOIN_RPC_USER and INDEXER_BITCOIN_RPC_PASSWORD"),
  INDEXER_BITCOIN_RPC_USER: z.string().min(1),
  INDEXER_BITCOIN_RPC_PASSWORD: z.string().min(1),
  INDEXER_BITCOIN_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  INDEXER_MAX_REORG_DEPTH: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

export interface Config {
  databaseUrl: string;
  network: Network;
  rpc: { url: string; user: string; password: string; timeoutMs: number };
  pollIntervalMs: number;
  maxReorgDepth: number;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new ConfigError(`invalid environment:\n${problems.join("\n")}`);
  }
  const e = result.data;
  return {
    databaseUrl: e.INDEXER_DATABASE_URL,
    network: e.INDEXER_BITCOIN_NETWORK,
    rpc: {
      url: e.INDEXER_BITCOIN_RPC_URL,
      user: e.INDEXER_BITCOIN_RPC_USER,
      password: e.INDEXER_BITCOIN_RPC_PASSWORD,
      timeoutMs: e.INDEXER_BITCOIN_RPC_TIMEOUT_MS,
    },
    pollIntervalMs: e.INDEXER_POLL_INTERVAL_MS,
    maxReorgDepth: e.INDEXER_MAX_REORG_DEPTH,
    logLevel: e.LOG_LEVEL,
  };
}
