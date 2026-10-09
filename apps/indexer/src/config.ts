import { z } from "zod";
import { NETWORKS, type Network } from "./chain/network.ts";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const envSchema = z.object({
  DATABASE_URL: z.url(),
  BITCOIN_NETWORK: z.enum(NETWORKS),
  BITCOIN_RPC_URL: z.url().refine((value) => {
    const url = new URL(value);
    return url.username === "" && url.password === "";
  }, "must not contain credentials; use BITCOIN_RPC_USER and BITCOIN_RPC_PASSWORD"),
  BITCOIN_RPC_USER: z.string().min(1),
  BITCOIN_RPC_PASSWORD: z.string().min(1),
  BITCOIN_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  MAX_REORG_DEPTH: z.coerce.number().int().positive().default(100),
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
    databaseUrl: e.DATABASE_URL,
    network: e.BITCOIN_NETWORK,
    rpc: {
      url: e.BITCOIN_RPC_URL,
      user: e.BITCOIN_RPC_USER,
      password: e.BITCOIN_RPC_PASSWORD,
      timeoutMs: e.BITCOIN_RPC_TIMEOUT_MS,
    },
    pollIntervalMs: e.POLL_INTERVAL_MS,
    maxReorgDepth: e.MAX_REORG_DEPTH,
    logLevel: e.LOG_LEVEL,
  };
}
