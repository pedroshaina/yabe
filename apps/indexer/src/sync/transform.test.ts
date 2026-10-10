import { describe, expect, it } from "vitest";
import type { RpcBlock, RpcTransaction } from "../rpc/schemas.ts";
import { blockToRows, InvalidBlockDataError } from "./transform.ts";

const h = (n: number): string => n.toString(16).padStart(64, "0");
const P2WPKH = {
  hex: "0014fe58819ea47c304b3aed416d5769d9ad562e515e",
  type: "witness_v0_keyhash",
  address: "bcrt1qlevgr84y0scykwhdg9k4w6we44tzu527lak7d3",
};

function coinbase(txid: string, value: number): RpcTransaction {
  return {
    txid,
    version: 2,
    size: 168,
    vsize: 141,
    weight: 564,
    locktime: 0,
    vin: [{ coinbase: "016600", txinwitness: ["00".repeat(32)], sequence: 4294967294 }],
    vout: [
      { value, n: 0, scriptPubKey: P2WPKH },
      { value: 0, n: 1, scriptPubKey: { hex: "6a24aa21a9ed", type: "nulldata" } },
    ],
  };
}

function spend(txid: string, prevTxid: string, fee: number | undefined): RpcTransaction {
  return {
    txid,
    version: 2,
    size: 222,
    vsize: 141,
    weight: 561,
    locktime: 101,
    vin: [
      {
        txid: prevTxid,
        vout: 0,
        scriptSig: { hex: "" },
        txinwitness: ["3044", "02fe"],
        prevout: { value: 50, scriptPubKey: P2WPKH },
        sequence: 4294967293,
      },
    ],
    vout: [
      { value: 1.5, n: 0, scriptPubKey: { ...P2WPKH, address: "bcrt1qdest" } },
      { value: 48.4999859, n: 1, scriptPubKey: { ...P2WPKH, address: "bcrt1qchange" } },
    ],
    ...(fee === undefined ? {} : { fee }),
  };
}

function block(height: number, tx: RpcTransaction[]): RpcBlock {
  return {
    hash: h(1000 + height),
    height,
    version: 0x20000000,
    merkleroot: h(2000 + height),
    time: 1_700_000_000 + height,
    mediantime: 1_700_000_000 + height,
    nonce: 4_294_967_295,
    bits: "207fffff",
    difficulty: 4.6565423739069247e-10,
    nTx: tx.length,
    ...(height === 0 ? {} : { previousblockhash: h(1000 + height - 1) }),
    strippedsize: 200,
    size: 300,
    weight: 900,
    tx,
  };
}

describe("blockToRows", () => {
  it("maps the genesis block", () => {
    const rows = blockToRows(block(0, [coinbase(h(1), 50)]), "regtest");

    expect(rows.block).toMatchObject({
      height: 0,
      prevHash: null,
      nonce: 4_294_967_295n,
      time: 1_700_000_000n,
      subsidySat: 5_000_000_000n,
      totalFeeSat: 0n,
      txCount: 1,
    });
    expect(rows.transactions[0]?.transaction).toMatchObject({
      position: 0,
      isCoinbase: true,
      feeSat: null,
    });
    expect(rows.transactions[0]?.inputs).toEqual([
      {
        index: 0,
        prevTxid: null,
        prevIndex: null,
        prevValueSat: null,
        prevAddress: null,
        prevScriptType: null,
        sequence: 4_294_967_294n,
        scriptSigHex: null,
        witness: ["00".repeat(32)],
        coinbaseHex: "016600",
      },
    ]);
  });

  it("maps a spend with its prevout, fee and outputs", () => {
    const rows = blockToRows(
      block(102, [coinbase(h(1), 50.0000141), spend(h(2), h(9), 0.0000141)]),
      "regtest",
    );
    const tx = rows.transactions[1];

    expect(tx?.transaction).toMatchObject({
      txid: h(2),
      position: 1,
      isCoinbase: false,
      feeSat: 1_410n,
      locktime: 101n,
    });
    expect(tx?.inputs).toEqual([
      {
        index: 0,
        prevTxid: h(9),
        prevIndex: 0,
        prevValueSat: 5_000_000_000n,
        prevAddress: P2WPKH.address,
        prevScriptType: "witness_v0_keyhash",
        sequence: 4_294_967_293n,
        scriptSigHex: null,
        witness: ["3044", "02fe"],
        coinbaseHex: null,
      },
    ]);
    expect(tx?.outputs).toEqual([
      {
        index: 0,
        valueSat: 150_000_000n,
        scriptType: "witness_v0_keyhash",
        address: "bcrt1qdest",
        scriptHex: P2WPKH.hex,
      },
      {
        index: 1,
        valueSat: 4_849_998_590n,
        scriptType: "witness_v0_keyhash",
        address: "bcrt1qchange",
        scriptHex: P2WPKH.hex,
      },
    ]);
    expect(rows.block.totalFeeSat).toBe(1_410n);
  });

  it("stores a transaction version of 2^31 or more as the signed 32-bit value", () => {
    // Core 31 reports nVersion unsigned; consensus allows any 32-bit value. The column is int4.
    const tx = { ...spend(h(2), h(9), 0.0001), version: 0xffffffff };

    const rows = blockToRows(block(5, [coinbase(h(1), 50), tx]), "regtest");

    expect(rows.transactions[1]?.transaction.version).toBe(-1);
  });

  it("stores an output without an address as null", () => {
    const rows = blockToRows(block(1, [coinbase(h(1), 50)]), "regtest");

    expect(rows.transactions[0]?.outputs[1]).toMatchObject({
      scriptType: "nulldata",
      address: null,
      valueSat: 0n,
    });
  });

  it("uses the network's halving interval for the subsidy", () => {
    expect(blockToRows(block(150, [coinbase(h(1), 25)]), "regtest").block.subsidySat).toBe(
      2_500_000_000n,
    );
    expect(blockToRows(block(150, [coinbase(h(1), 50)]), "signet").block.subsidySat).toBe(
      5_000_000_000n,
    );
  });

  it("rejects a non-coinbase transaction without fee", () => {
    expect(() =>
      blockToRows(block(5, [coinbase(h(1), 50), spend(h(2), h(9), undefined)]), "regtest"),
    ).toThrow(InvalidBlockDataError);
    expect(() =>
      blockToRows(block(5, [coinbase(h(1), 50), spend(h(2), h(9), undefined)]), "regtest"),
    ).toThrow(/fee/);
  });

  it("rejects a non-coinbase input without prevout", () => {
    const tx = spend(h(2), h(9), 0.0001);
    const { prevout: _drop, ...input } = tx.vin[0]!;
    const broken = { ...tx, vin: [input] };

    expect(() => blockToRows(block(5, [coinbase(h(1), 50), broken]), "regtest")).toThrow(/prevout/);
  });

  it("rejects a block whose first transaction is not a coinbase", () => {
    expect(() => blockToRows(block(5, [spend(h(2), h(9), 0.0001)]), "regtest")).toThrow(/coinbase/);
  });

  it("rejects a block whose nTx doesn't match its transactions", () => {
    expect(() => blockToRows({ ...block(5, [coinbase(h(1), 50)]), nTx: 2 }, "regtest")).toThrow(
      /nTx/,
    );
  });

  it("rejects a non-genesis block without previousblockhash", () => {
    const { previousblockhash: _drop, ...orphan } = block(5, [coinbase(h(1), 50)]);

    expect(() => blockToRows(orphan, "regtest")).toThrow(/previousblockhash/);
  });
});
