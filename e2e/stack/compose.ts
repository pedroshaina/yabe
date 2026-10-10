import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ENGINE =
  spawnSync("docker", ["--version"], { stdio: "ignore" }).status === 0 ? "docker" : "podman";
const PROJECT = ["compose", "-p", "yabe-e2e", "-f", "compose.yaml", "-f", "compose.e2e.yaml"];

/** `<docker|podman> compose` on the e2e project, from the repo root; output goes to the terminal. */
export function compose(...args: string[]): void {
  execFileSync(ENGINE, [...PROJECT, ...args], { cwd: ROOT, stdio: "inherit" });
}

/** bitcoin-cli on the regtest node; returns its trimmed output. */
export function cli(...args: string[]): string {
  return execFileSync(
    ENGINE,
    [
      ...PROJECT,
      "exec",
      "-T",
      "bitcoind",
      "bitcoin-cli",
      "-regtest",
      "-rpcport=38332",
      "-datadir=/home/bitcoin/.bitcoin",
      ...args,
    ],
    // stderr is kept in the thrown error rather than printed: some failures are expected
    // (loadwallet before the wallet exists).
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

/** Retries `check` once a second until it returns true (a throw counts as not yet). */
export async function waitFor(
  what: string,
  check: () => boolean | Promise<boolean>,
  seconds = 180,
): Promise<void> {
  for (let i = 0; i < seconds; i++) {
    try {
      if (await check()) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** The container engine itself (docker or podman), e.g. inspect or logs; returns stdout. */
export function engineOutput(...args: string[]): string {
  return execFileSync(ENGINE, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
