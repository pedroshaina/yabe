import Link from "next/link";
import type { TxSummary } from "@/lib/api/types";
import { formatSbtc, plural } from "@/lib/format";
import styles from "./TxCard.module.css";

export function TxCard({ tx }: { tx: TxSummary }) {
  return (
    <li>
      <Link href={`/tx/${tx.txid}`} className={styles.card}>
        <div className={styles.row}>
          <span className={styles.lead}>
            <span className={styles.position}>{tx.position}</span>
            <span className={styles.txid}>{tx.txid}</span>
          </span>
          <span className={styles.amount}>{formatSbtc(tx.totalOutSat)}</span>
        </div>
        <div className={`${styles.row} ${styles.meta}`}>
          <span>{`${plural(tx.inputCount, "input")} → ${plural(tx.outputCount, "output")}`}</span>
          {tx.isCoinbase || tx.feeSat === null ? (
            <span className={styles.badge}>coinbase</span>
          ) : (
            <span>{`Fee ${formatSbtc(tx.feeSat)}`}</span>
          )}
        </div>
      </Link>
    </li>
  );
}
