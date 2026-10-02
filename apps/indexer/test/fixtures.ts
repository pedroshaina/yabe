import { createHash } from 'node:crypto'
import type { RpcBlock, RpcTx } from '@yabe/bitcoin-rpc'

export const fakeHash = (seed: string): string => createHash('sha256').update(seed).digest('hex')
const p2wpkh = (seed: string) => ({
  asm: '',
  hex: `0014${fakeHash(seed).slice(0, 40)}`,
  address: `bcrt1q${fakeHash(seed).slice(0, 38)}`,
  type: 'witness_v0_keyhash',
})

export const makeCoinbaseTx = (height: number, opts: { valueBtc?: number; seed?: string } = {}): RpcTx => {
  const seed = opts.seed ?? `coinbase-${height}`
  return {
    txid: fakeHash(seed),
    hash: fakeHash(seed),
    version: 2,
    size: 100,
    vsize: 100,
    weight: 400,
    locktime: 0,
    vin: [{ coinbase: `03${height.toString(16).padStart(6, '0')}`, sequence: 4_294_967_295 }],
    vout: [{ value: opts.valueBtc ?? 50, n: 0, scriptPubKey: p2wpkh(`${seed}-out`) }],
    hex: '',
  }
}

export const makeSpendTx = (
  seed: string,
  spends: { txid: string; vout: number; valueBtc: number }[],
  outputsBtc: number[],
  feeBtc: number,
): RpcTx => ({
  txid: fakeHash(seed),
  hash: fakeHash(`${seed}-witness`),
  version: 2,
  size: 222,
  vsize: 141,
  weight: 561,
  locktime: 0,
  vin: spends.map((s) => ({
    txid: s.txid,
    vout: s.vout,
    scriptSig: { asm: '', hex: '' },
    txinwitness: ['3044aa', '02bb'],
    sequence: 4_294_967_293,
    prevout: { generated: false, height: 1, value: s.valueBtc, scriptPubKey: p2wpkh(`${s.txid}-${s.vout}`) },
  })),
  vout: outputsBtc.map((value, n) => ({ value, n, scriptPubKey: p2wpkh(`${seed}-out-${n}`) })),
  fee: feeBtc,
  hex: '',
})

export const makeBlock = (opts: {
  height: number
  prevHash: string | undefined
  txs: RpcTx[]
  seed?: string
}): RpcBlock => ({
  hash: fakeHash(opts.seed ?? `block-${opts.height}`),
  confirmations: 1,
  height: opts.height,
  version: 0x20000000,
  versionHex: '20000000',
  merkleroot: fakeHash(`merkle-${opts.seed ?? opts.height}`),
  time: 1_767_225_600 + opts.height * 600,
  mediantime: 1_767_225_600 + opts.height * 600 - 300,
  nonce: 42,
  bits: '207fffff',
  difficulty: 4.656542373906925e-10,
  chainwork: `${'00'.repeat(31)}02`,
  nTx: opts.txs.length,
  ...(opts.prevHash === undefined ? {} : { previousblockhash: opts.prevHash }),
  strippedsize: 200,
  size: 300,
  weight: 900,
  tx: opts.txs,
})

// A linear chain of coinbase-only blocks; `seedPrefix` lets tests build competing branches.
export const makeChain = (
  length: number,
  seedPrefix = 'main',
  startHeight = 0,
  prevHash?: string,
): RpcBlock[] => {
  const blocks: RpcBlock[] = []
  let prev = prevHash
  for (let height = startHeight; height < startHeight + length; height++) {
    const block = makeBlock({
      height,
      prevHash: prev,
      txs: [makeCoinbaseTx(height, { seed: `${seedPrefix}-cb-${height}` })],
      seed: `${seedPrefix}-${height}`,
    })
    blocks.push(block)
    prev = block.hash
  }
  return blocks
}
