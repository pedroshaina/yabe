import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Loads the repo's root .env (shared with the indexer and the API), then runs the Next.js CLI
// with this script's arguments. `node --env-file-if-exists` can't do it: Next.js copies node's
// flags into NODE_OPTIONS for its child processes, where that flag isn't allowed.
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
await import(nextBin);
