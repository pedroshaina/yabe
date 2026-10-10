import { pino, type Logger } from "pino";
import { getConfig } from "@/config";

let logger: Logger | undefined;

/** JSON logs on stdout, like the indexer and the API. Server-only. */
export function getLogger(): Logger {
  logger ??= pino({ level: getConfig().logLevel });
  return logger;
}
