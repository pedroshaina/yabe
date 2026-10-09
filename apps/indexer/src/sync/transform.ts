import { btcToSats } from "../chain/amounts.ts";
import type { Network } from "../chain/network.ts";
import { blockSubsidySat } from "../chain/subsidy.ts";
import type { RpcBlock, RpcTransaction } from "../rpc/schemas.ts";

export interface BlockRow {
  height: number;
  hash: string;
  prevHash: string | null;
  merkleRoot: string;
  version: number;
  bits: string;
  nonce: bigint;
  difficulty: number;
  time: bigint;
  medianTime: bigint;
  size: number;
  strippedSize: number;
  weight: number;
  txCount: number;
  subsidySat: bigint;
  totalFeeSat: bigint;
}

export interface TransactionRow {
  txid: string;
  position: number;
  version: number;
  locktime: bigint;
  size: number;
  vsize: number;
  weight: number;
  feeSat: bigint | null;
  isCoinbase: boolean;
}

export interface OutputRow {
  index: number;
  valueSat: bigint;
  scriptType: string;
  address: string | null;
  scriptHex: string;
}

export interface InputRow {
  index: number;
  prevTxid: string | null;
  prevIndex: number | null;
  prevValueSat: bigint | null;
  prevAddress: string | null;
  prevScriptType: string | null;
  sequence: bigint;
  scriptSigHex: string | null;
  witness: string[];
  coinbaseHex: string | null;
}

export interface TransactionRows {
  transaction: TransactionRow;
  inputs: InputRow[];
  outputs: OutputRow[];
}

export interface BlockRows {
  block: BlockRow;
  transactions: TransactionRows[];
}

/** The node returned a block we can't store faithfully. Fatal: never write partial data. */
export class InvalidBlockDataError extends Error {
  override name = "InvalidBlockDataError";
}

export function blockToRows(block: RpcBlock, network: Network): BlockRows {
  const where = `block ${block.height} (${block.hash})`;
  if (block.nTx !== block.tx.length) {
    throw new InvalidBlockDataError(
      `${where}: nTx is ${block.nTx} but ${block.tx.length} transactions were returned`,
    );
  }
  if (block.height > 0 && block.previousblockhash === undefined) {
    throw new InvalidBlockDataError(`${where}: missing previousblockhash`);
  }

  const transactions = block.tx.map((tx, position) => transactionToRows(tx, position, where));
  const totalFeeSat = transactions.reduce((sum, t) => sum + (t.transaction.feeSat ?? 0n), 0n);

  return {
    block: {
      height: block.height,
      hash: block.hash,
      prevHash: block.previousblockhash ?? null,
      merkleRoot: block.merkleroot,
      version: block.version,
      bits: block.bits,
      nonce: BigInt(block.nonce),
      difficulty: block.difficulty,
      time: BigInt(block.time),
      medianTime: BigInt(block.mediantime),
      size: block.size,
      strippedSize: block.strippedsize,
      weight: block.weight,
      txCount: block.nTx,
      subsidySat: blockSubsidySat(block.height, network),
      totalFeeSat,
    },
    transactions,
  };
}

function transactionToRows(tx: RpcTransaction, position: number, where: string): TransactionRows {
  const isCoinbase = tx.vin[0]?.coinbase !== undefined;
  if (isCoinbase !== (position === 0)) {
    throw new InvalidBlockDataError(
      `${where}: transaction ${tx.txid} at position ${position} ${isCoinbase ? "is" : "is not"} a coinbase`,
    );
  }
  if (!isCoinbase && tx.fee === undefined) {
    throw new InvalidBlockDataError(
      `${where}: transaction ${tx.txid} has no fee; the node may be pruned or missing undo data`,
    );
  }

  return {
    transaction: {
      txid: tx.txid,
      position,
      version: tx.version,
      locktime: BigInt(tx.locktime),
      size: tx.size,
      vsize: tx.vsize,
      weight: tx.weight,
      feeSat: isCoinbase ? null : btcToSats(tx.fee!),
      isCoinbase,
    },
    inputs: tx.vin.map((input, index): InputRow => {
      const common = {
        index,
        sequence: BigInt(input.sequence),
        scriptSigHex: input.scriptSig?.hex || null,
        witness: input.txinwitness ?? [],
      };
      if (input.coinbase !== undefined) {
        return {
          ...common,
          prevTxid: null,
          prevIndex: null,
          prevValueSat: null,
          prevAddress: null,
          prevScriptType: null,
          coinbaseHex: input.coinbase,
        };
      }
      if (input.txid === undefined || input.vout === undefined || input.prevout === undefined) {
        throw new InvalidBlockDataError(
          `${where}: input ${index} of ${tx.txid} has no txid/vout/prevout; the node may be pruned or missing undo data`,
        );
      }
      return {
        ...common,
        prevTxid: input.txid,
        prevIndex: input.vout,
        prevValueSat: btcToSats(input.prevout.value),
        prevAddress: input.prevout.scriptPubKey.address ?? null,
        prevScriptType: input.prevout.scriptPubKey.type,
        coinbaseHex: null,
      };
    }),
    outputs: tx.vout.map((output) => ({
      index: output.n,
      valueSat: btcToSats(output.value),
      scriptType: output.scriptPubKey.type,
      address: output.scriptPubKey.address ?? null,
      scriptHex: output.scriptPubKey.hex,
    })),
  };
}
