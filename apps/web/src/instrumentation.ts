import { PHASE_PRODUCTION_BUILD } from "next/constants";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    return;
  }
  const { ConfigError, getConfig } = await import("./config");
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
