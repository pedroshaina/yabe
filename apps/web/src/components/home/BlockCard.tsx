import Link from "next/link";
import { BitcoinIcon, CubeMarker, SizeIcon, TxCountIcon } from "@/components/ui/icons";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { BlockSummary } from "@/lib/api/types";
import { formatInteger, formatSbtc, formatSize } from "@/lib/format";
import styles from "./BlockCard.module.css";
import timeline from "./Timeline.module.css";

interface Props {
  block: BlockSummary;
  newest: boolean;
  serverNow: number;
}

/** One block on the home timeline. Desktop and phone layouts are both rendered; CSS picks one. */
export function BlockCard({ block, newest, serverNow }: Props) {
  const height = formatInteger(block.height);
  const txs = (
    <span className={styles.stat}>
      <TxCountIcon className={styles.statIcon} />
      {formatInteger(block.txCount)}
      <span className={styles.unit}>txs</span>
    </span>
  );
  const size = (
    <span className={styles.stat}>
      <SizeIcon className={styles.statIcon} />
      <span className="visually-hidden">Size </span>
      {formatSize(block.size)}
    </span>
  );
  const fees = (
    <span className={`${styles.stat} ${styles.mono}`}>
      <BitcoinIcon className={styles.statIcon} />
      <span className="visually-hidden">Fees </span>
      {formatSbtc(block.totalFeeSat)}
      <span className="visually-hidden"> sBTC</span>
    </span>
  );
  const time = <RelativeTime time={block.time} serverNow={serverNow} />;

  return (
    <li className={timeline.item}>
      <div className={timeline.rail}>
        <CubeMarker className={timeline.marker} tinted={newest} />
        <div className={timeline.line} />
      </div>
      <Link href={`/block/${block.height}`} className={styles.card}>
        <div className={styles.desktop}>
          <div className={styles.column}>
            <span className={styles.height}>{height}</span>
            <span className={styles.hash}>{block.hash}</span>
            {fees}
          </div>
          <div className={`${styles.column} ${styles.right}`}>
            <span className={styles.time}>{time}</span>
            {txs}
            {size}
          </div>
        </div>
        <div className={styles.phone}>
          <div className={styles.row}>
            <span className={styles.height}>{height}</span>
            <span className={styles.time}>{time}</span>
          </div>
          <span className={styles.hash}>{block.hash}</span>
          <div className={styles.strip}>
            {txs}
            {size}
            {fees}
          </div>
        </div>
      </Link>
    </li>
  );
}
