import type { Transaction } from "@/lib/api/types";

export const TXID = "7c3e9f1a0b2d48e6c5a17f93d0e24b6a8f1c35d79e0b2a4c6d8e1f3a5b7c9d0e";
const PREV = "a91c3b7e5d2f08c61e4a9b3d7f0c25e8a6d14b9f3e07c52a8d6b1f4e9c3a04e2";
const SPENDER = "d04f6a2e9c1b7d3f5e08a4c6b2d91e7f3a5c08b6d4e2f19a7c3b5d0e8f6ac18b";

export const tx: Transaction = {
  txid: TXID,
  blockHash: "0".repeat(64),
  blockHeight: 318440,
  blockTime: 1_791_590_000,
  position: 14,
  confirmations: 3,
  version: 2,
  locktime: 318439,
  size: 222,
  vsize: 141,
  weight: 561,
  isCoinbase: false,
  feeSat: 1410,
  feeRate: 10,
  inputs: [
    {
      index: 0,
      coinbaseHex: null,
      prevTxid: PREV,
      prevIndex: 1,
      valueSat: 20_000_000,
      address: "tb1qinputone",
      scriptType: "witness_v0_keyhash",
      scriptSig: { hex: "", asm: "" },
      witness: ["3044aa", "02bb"],
      sequence: 4294967293,
    },
    {
      index: 1,
      coinbaseHex: null,
      prevTxid: PREV,
      prevIndex: 0,
      valueSat: 5_001_410,
      address: null,
      scriptType: "nonstandard",
      scriptSig: { hex: "51", asm: "OP_1" },
      witness: [],
      sequence: 4294967293,
    },
  ],
  outputs: [
    {
      index: 0,
      valueSat: 24_000_000,
      address: "tb1poutputone",
      scriptType: "witness_v1_taproot",
      script: { hex: "5120ab", asm: "1 ab" },
      spentBy: { txid: SPENDER, inputIndex: 0 },
    },
    {
      index: 1,
      valueSat: 0,
      address: null,
      scriptType: "nulldata",
      script: { hex: "6a0568656c6c6f", asm: "OP_RETURN 68656c6c6f" },
      spentBy: null,
    },
    {
      index: 2,
      valueSat: 1_000_000,
      address: "tb1qoutputtwo",
      scriptType: "witness_v0_keyhash",
      script: { hex: "0014cd", asm: "0 cd" },
      spentBy: null,
    },
  ],
};

export const coinbase: Transaction = {
  ...tx,
  position: 0,
  isCoinbase: true,
  feeSat: null,
  feeRate: null,
  inputs: [
    {
      index: 0,
      coinbaseHex: "03e8db04",
      prevTxid: null,
      prevIndex: null,
      valueSat: null,
      address: null,
      scriptType: null,
      scriptSig: null,
      witness: [],
      sequence: 4294967295,
    },
  ],
  outputs: [tx.outputs[0]!],
};
