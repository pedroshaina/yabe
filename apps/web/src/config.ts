import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** An origin like http://yabe-api:8080: http(s), no path, query or fragment (a trailing "/" is fine). */
function isOrigin(value: string): boolean {
  // Zod still runs refinements after z.url() fails, so the value may not parse.
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === ""
  );
}

/** `WEB_`-prefixed: the host .env is shared with the indexer and the API. */
const envSchema = z.object({
  WEB_API_URL: z
    .url()
    .refine(isOrigin, { error: "must be an http(s) origin, e.g. http://yabe-api:8080" }),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

export interface Config {
  /** yabe-api's origin, without a trailing slash. */
  apiUrl: string;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new ConfigError(`invalid environment:\n${problems.join("\n")}`);
  }
  return {
    apiUrl: new URL(result.data.WEB_API_URL).origin,
    logLevel: result.data.LOG_LEVEL,
  };
}

let config: Config | undefined;

/** The process's configuration, validated once. Server-only. */
export function getConfig(): Config {
  config ??= loadConfig();
  return config;
}
