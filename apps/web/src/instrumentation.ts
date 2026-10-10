// Runs once when a server starts. Node-only code lives in instrumentation-node.ts so the
// Edge bundle never compiles it.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkConfigOrExit } = await import("./instrumentation-node");
    checkConfigOrExit();
  }
}
