import type { components } from "./schema";

export type BlockSummary = components["schemas"]["BlockSummary"];
export type Tip = components["schemas"]["Tip"];
export interface BlocksPage {
  blocks: BlockSummary[];
  next: number | null;
}
