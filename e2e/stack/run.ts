import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compose } from "./compose.ts";

// The whole run: up, seed, the Playwright suite (extra arguments go to it), and always down.
const script = (name: string) => fileURLToPath(new URL(`${name}.ts`, import.meta.url));
const run = (command: string, args: string[]) =>
  spawnSync(command, args, { stdio: "inherit" }).status === 0;

let ok: boolean;
try {
  ok =
    run("node", [script("up")]) &&
    run("node", [script("seed")]) &&
    run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)]);
  if (!ok) {
    console.error("e2e run failed; recent logs:");
    try {
      compose("logs", "--no-color", "--tail=100");
    } catch {
      // the stack may never have started
    }
  }
} finally {
  run("node", [script("down")]);
}
process.exit(ok ? 0 : 1);
