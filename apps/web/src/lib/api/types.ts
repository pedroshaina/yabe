import type { components } from "./schema";

export type BlockSummary = components["schemas"]["BlockSummary"];
export type Tip = components["schemas"]["Tip"];
export interface BlocksPage {
  blocks: BlockSummary[];
  next: number | null;
}
export type Block = components["schemas"]["Block"];
export type TxSummary = components["schemas"]["TransactionSummary"];
export type Transaction = components["schemas"]["Transaction"];
export type TxInput = Transaction["inputs"][number];
export type TxOutput = Transaction["outputs"][number];
export interface TxPage {
  transactions: TxSummary[];
  next: number | null;
}
