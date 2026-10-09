import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** `API_`-prefixed: the host .env is shared with the indexer, whose database URL is read-write. */
const envSchema = z.object({
  API_DATABASE_URL: z.url(),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  API_CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  API_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

export interface Config {
  databaseUrl: string;
  host: string;
  port: number;
  corsOrigins: string[];
  logLevel: LogLevel;
  queryTimeoutMs: number;
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
    databaseUrl: e.API_DATABASE_URL,
    host: e.API_HOST,
    port: e.API_PORT,
    corsOrigins: e.API_CORS_ORIGINS,
    logLevel: e.LOG_LEVEL,
    queryTimeoutMs: e.API_QUERY_TIMEOUT_MS,
  };
}
