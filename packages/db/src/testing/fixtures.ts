export const hash = (n: number): string => n.toString(16).padStart(64, "0");

export function blockData(height: number) {
  return {
    height,
    hash: hash(1000 + height),
    prevHash: height === 0 ? null : hash(1000 + height - 1),
    merkleRoot: hash(2000 + height),
    version: 0x20000000,
    bits: "1d00ffff",
    nonce: 0n,
    difficulty: 1,
    time: 1_700_000_000n + BigInt(height) * 600n,
    medianTime: 1_700_000_000n + BigInt(height) * 600n,
    size: 285,
    strippedSize: 249,
    weight: 1032,
    txCount: 1,
    subsidySat: 5_000_000_000n,
    totalFeeSat: 0n,
  };
}

export function transactionData(blockHeight: number, position: number, txid: string) {
  return {
    txid,
    blockHeight,
    position,
    version: 2,
    locktime: 0n,
    size: 200,
    vsize: 150,
    weight: 600,
    feeSat: position === 0 ? null : 1_000n,
    isCoinbase: position === 0,
  };
}
