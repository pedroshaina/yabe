import Link from "next/link";
import { TxIcon } from "@/components/ui/icons";
import type { Transaction, TxInput, TxOutput } from "@/lib/api/types";
import { formatInteger, formatSbtc, formatSbtcOrDash, plural, shortHash } from "@/lib/format";
import styles from "./FlowOfFunds.module.css";

function sum(values: (number | null)[]): number | null {
  return values.some((v) => v === null) ? null : values.reduce<number>((a, v) => a + (v ?? 0), 0);
}

function InputCard({ input }: { input: TxInput }) {
  const isCoinbase = input.prevTxid === null;
  return (
    <li className={styles.card}>
      <div className={styles.row}>
        <span className={styles.who}>
          {isCoinbase ? "Coinbase (new coins)" : (input.address ?? input.scriptType ?? "unknown")}
        </span>
        {!isCoinbase && <span className={styles.value}>{formatSbtcOrDash(input.valueSat)}</span>}
      </div>
      {!isCoinbase && (
        <div className={styles.meta}>
          from{" "}
          <Link href={`/tx/${input.prevTxid}`} className="mono">
            {`${shortHash(input.prevTxid!)}:${input.prevIndex}`}
          </Link>
        </div>
      )}
    </li>
  );
}

function OutputCard({ output }: { output: TxOutput }) {
  return (
    <li className={styles.card}>
      <div className={styles.row}>
        <span className={styles.who}>{output.address ?? output.scriptType}</span>
        <span className={styles.value}>{formatSbtc(output.valueSat)}</span>
      </div>
      <div className={styles.meta}>
        {output.spentBy ? (
          <Link
            href={`/tx/${output.spentBy.txid}`}
          >{`Spent in ${shortHash(output.spentBy.txid)}`}</Link>
        ) : (
          "Unspent"
        )}
      </div>
    </li>
  );
}

export function FlowOfFunds({ tx }: { tx: Transaction }) {
  const totalIn = tx.isCoinbase ? null : sum(tx.inputs.map((i) => i.valueSat));
  const totalOut = tx.outputs.reduce((a, o) => a + o.valueSat, 0);
  return (
    <div className={styles.flow}>
      <section aria-labelledby="flow-from">
        <h2 id="flow-from" className={styles.heading}>
          <span>{`From · ${plural(tx.inputs.length, "input")}`}</span>
          {totalIn !== null && <span className="mono">{`${formatSbtc(totalIn)} sBTC`}</span>}
        </h2>
        <ol className={styles.list}>
          {tx.inputs.map((input) => (
            <InputCard key={input.index} input={input} />
          ))}
        </ol>
      </section>
      <div className={styles.connector}>
        <span className={styles.rail} aria-hidden="true" />
        <span className={styles.feeLine}>
          <TxIcon className={styles.feeIcon} />
          <span>
            {tx.feeSat === null
              ? `Coinbase · ${formatInteger(tx.vsize)} vB`
              : `Fee ${formatSbtc(tx.feeSat)} sBTC · ${formatInteger(tx.vsize)} vB`}
          </span>
        </span>
      </div>
      <section aria-labelledby="flow-to">
        <h2 id="flow-to" className={styles.heading}>
          <span>{`To · ${plural(tx.outputs.length, "output")}`}</span>
          <span className="mono">{`${formatSbtc(totalOut)} sBTC`}</span>
        </h2>
        <ol className={styles.list}>
          {tx.outputs.map((output) => (
            <OutputCard key={output.index} output={output} />
          ))}
        </ol>
      </section>
    </div>
  );
}
