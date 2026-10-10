import type { ReactNode } from "react";
import styles from "./TechnicalDetails.module.css";

interface Item {
  label: string;
  value: ReactNode;
  /** Spans both columns (long values like a merkle root). */
  wide?: boolean;
}

export function TechnicalDetails({ items, children }: { items: Item[]; children?: ReactNode }) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>Technical details</summary>
      <dl className={styles.grid}>
        {items.map((item) => (
          <div key={item.label} className={item.wide ? styles.wide : undefined}>
            <dt className={styles.label}>{item.label}</dt>
            <dd className={styles.value}>{item.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </details>
  );
}
