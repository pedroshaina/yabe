import { describe, expect, it } from "vitest";
import { btcToSats } from "./amounts.ts";
import { halvingInterval, nodeChainName } from "./network.ts";
import { blockSubsidySat } from "./subsidy.ts";

describe("btcToSats", () => {
  it.each([
    [50, 5_000_000_000n],
    [0, 0n],
    [0.0000141, 1_410n],
    [48.4999859, 4_849_998_590n],
    [0.3, 30_000_000n],
    [0.00000001, 1n],
    [20_999_999.9769, 2_099_999_997_690_000n],
  ])("converts %s BTC to %s sat", (btc, sats) => {
    expect(btcToSats(btc)).toBe(sats);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 1e9])("rejects %s", (btc) => {
    expect(() => btcToSats(btc)).toThrow(RangeError);
  });
});

describe("network", () => {
  it("maps networks to the node's chain names", () => {
    expect(nodeChainName("mainnet")).toBe("main");
    expect(nodeChainName("testnet")).toBe("test");
    expect(nodeChainName("signet")).toBe("signet");
    expect(nodeChainName("regtest")).toBe("regtest");
  });

  it("halves every 150 blocks on regtest and 210,000 elsewhere", () => {
    expect(halvingInterval("regtest")).toBe(150);
    expect(halvingInterval("signet")).toBe(210_000);
    expect(halvingInterval("mainnet")).toBe(210_000);
  });
});

describe("blockSubsidySat", () => {
  it.each([
    [0, "mainnet", 5_000_000_000n],
    [209_999, "mainnet", 5_000_000_000n],
    [210_000, "mainnet", 2_500_000_000n],
    [840_000, "mainnet", 312_500_000n],
    [149, "regtest", 5_000_000_000n],
    [150, "regtest", 2_500_000_000n],
    [64 * 210_000, "signet", 0n],
    [100 * 210_000, "signet", 0n],
  ] as const)("height %s on %s is %s sat", (height, network, sats) => {
    expect(blockSubsidySat(height, network)).toBe(sats);
  });
});
