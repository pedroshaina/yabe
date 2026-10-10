import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { ConfigError, getConfig } from "./config";

/** Exits with a clear message when the environment is invalid. Skipped during `next build`. */
export function checkConfigOrExit(): void {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  try {
    getConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
