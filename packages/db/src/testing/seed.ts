import { createHash } from 'node:crypto'
import type { PrismaClient } from '../generated/client.js'
import { toTxNum } from '../txnum.js'

const hash = (seed: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(createHash('sha256').update(seed).digest())
const fromHex = (hex: string): Uint8Array<ArrayBuffer> => Uint8Array.from(Buffer.from(hex, 'hex'))
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex')

export const SEED = {
  p2wpkhScript: `0014${'11'.repeat(20)}`,
  p2trScript: `5120${'22'.repeat(32)}`,
  opReturnScript: '6a0568656c6c6f',
  malformedScript: '4c',
  witness: [`3044${'33'.repeat(68)}`, `02${'44'.repeat(32)}`],
} as const

export interface SeededChain {
  blockHashes: [string, string, string]
  txids: { coinbase0: string; coinbase1: string; coinbase2: string; spend: string }
}

// Three blocks:
//   0: coinbase0
//   1: coinbase1 (50 BTC, p2wpkh)
//   2: coinbase2, plus `spend`, which spends coinbase1:0 into p2tr 30 BTC, p2wpkh 19.9999 BTC,
//      OP_RETURN 0 and a malformed script 0, paying a 10,000 sat fee
export const seedChain = async (prisma: PrismaClient): Promise<SeededChain> => {
  const blockHashes = [hash('block-0'), hash('block-1'), hash('block-2')] as const
  const txids = {
    coinbase0: hash('cb-0'),
    coinbase1: hash('cb-1'),
    coinbase2: hash('cb-2'),
    spend: hash('spend'),
  }
  const genesisTime = Date.UTC(2026, 0, 1)
  const block = (height: 0 | 1 | 2) => ({
    height,
    hash: blockHashes[height],
    prevHash: height === 0 ? null : blockHashes[(height - 1) as 0 | 1],
    merkleRoot: hash(`mr-${height}`),
    chainwork: fromHex(`${'00'.repeat(31)}0${height + 1}`),
    version: 0x20000000,
    bits: 0x207fffffn,
    nonce: BigInt(height),
    difficulty: 4.656542373906925e-10,
    time: new Date(genesisTime + height * 600_000),
    medianTime: new Date(genesisTime + height * 600_000),
    size: 300,
    strippedSize: 200,
    weight: 900,
    subsidySats: 5_000_000_000n,
  })
  await prisma.block.createMany({
    data: [
      { ...block(0), txCount: 1, totalFeeSats: 0n, totalOutSats: 0n },
      { ...block(1), txCount: 1, totalFeeSats: 0n, totalOutSats: 0n },
      { ...block(2), txCount: 2, totalFeeSats: 10_000n, totalOutSats: 4_999_990_000n },
    ],
  })

  const coinbase = (height: number, txid: Uint8Array<ArrayBuffer>, valueSats: bigint) => {
    const txNum = toTxNum(height, 0)
    return {
      tx: {
        txNum,
        txid,
        wtxid: null,
        blockHeight: height,
        version: 2n,
        locktime: 0n,
        size: 100,
        vsize: 100,
        weight: 400,
        inputCount: 1,
        outputCount: 1,
        isCoinbase: true,
        feeSats: null,
      },
      input: {
        txNum,
        vin: 0,
        prevTxNum: null,
        prevVout: null,
        sequence: 4_294_967_295n,
        scriptSig: fromHex('0101'),
        witness: [],
      },
      output: {
        txNum,
        vout: 0,
        valueSats,
        scriptPubkey: fromHex(SEED.p2wpkhScript),
        scriptType: 'witness_v0_keyhash' as const,
        address: `bcrt1qminer${height}`,
      },
    }
  }
  const coinbases = [
    coinbase(0, txids.coinbase0, 5_000_000_000n),
    coinbase(1, txids.coinbase1, 5_000_000_000n),
    coinbase(2, txids.coinbase2, 5_000_010_000n),
  ]
  const spendNum = toTxNum(2, 1)

  await prisma.transaction.createMany({
    data: [
      ...coinbases.map((c) => c.tx),
      {
        txNum: spendNum,
        txid: txids.spend,
        wtxid: hash('spend-w'),
        blockHeight: 2,
        version: 2n,
        locktime: 0n,
        size: 250,
        vsize: 141,
        weight: 562,
        inputCount: 1,
        outputCount: 4,
        isCoinbase: false,
        feeSats: 10_000n,
      },
    ],
  })
  await prisma.txOutput.createMany({
    data: [
      ...coinbases.map((c) => c.output),
      {
        txNum: spendNum,
        vout: 0,
        valueSats: 3_000_000_000n,
        scriptPubkey: fromHex(SEED.p2trScript),
        scriptType: 'witness_v1_taproot',
        address: 'bcrt1ptaproot',
      },
      {
        txNum: spendNum,
        vout: 1,
        valueSats: 1_999_990_000n,
        scriptPubkey: fromHex(SEED.p2wpkhScript),
        scriptType: 'witness_v0_keyhash',
        address: 'bcrt1qchange',
      },
      {
        txNum: spendNum,
        vout: 2,
        valueSats: 0n,
        scriptPubkey: fromHex(SEED.opReturnScript),
        scriptType: 'nulldata',
        address: null,
      },
      {
        txNum: spendNum,
        vout: 3,
        valueSats: 0n,
        scriptPubkey: fromHex(SEED.malformedScript),
        scriptType: 'nonstandard',
        address: null,
      },
    ],
  })
  await prisma.txInput.createMany({
    data: [
      ...coinbases.map((c) => c.input),
      {
        txNum: spendNum,
        vin: 0,
        prevTxNum: toTxNum(1, 0),
        prevVout: 0,
        sequence: 4_294_967_293n,
        scriptSig: new Uint8Array(),
        witness: SEED.witness.map(fromHex),
      },
    ],
  })
  await prisma.syncState.create({
    data: {
      id: 1,
      network: 'regtest',
      nodeTipHeight: 3,
      indexedTipHeight: 2,
      updatedAt: new Date('2026-01-01T00:30:00Z'),
    },
  })

  return {
    blockHashes: [toHex(blockHashes[0]), toHex(blockHashes[1]), toHex(blockHashes[2])],
    txids: {
      coinbase0: toHex(txids.coinbase0),
      coinbase1: toHex(txids.coinbase1),
      coinbase2: toHex(txids.coinbase2),
      spend: toHex(txids.spend),
    },
  }
}
