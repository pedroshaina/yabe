import { readFileSync } from "node:fs";
import { SEED_FILE } from "../stack/urls.ts";

export interface Seed {
  tip: number;
  bigBlock: { height: number; hash: string; txCount: number };
  spendTxid: string;
}

function load(): Seed {
  try {
    return JSON.parse(readFileSync(SEED_FILE, "utf8")) as Seed;
  } catch {
    throw new Error(`no ${SEED_FILE}: run pnpm e2e:up and pnpm e2e:seed first (or pnpm e2e)`);
  }
}

export const seed = load();

/** Heights and counts as the UI shows them: 1,234. */
export const grouped = (n: number) => n.toLocaleString("en-US");
