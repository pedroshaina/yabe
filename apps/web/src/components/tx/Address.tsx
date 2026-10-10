"use client";

import { useId, useState } from "react";
import { middleEllipsis } from "@/lib/format";
import styles from "./Address.module.css";

/**
 * An address in a flow card. Desktop shows it whole. Phones show the middle-ellipsis form, and a
 * tap shows it all. The button's name is always the full address.
 */
export function Address({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const hintId = useId();
  const short = middleEllipsis(address);
  if (short === address) return <>{address}</>;
  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-describedby={hintId}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.full}>{address}</span>
        <span className={styles.short} aria-hidden="true">
          {short}
        </span>
      </button>
      <span id={hintId} className="visually-hidden">
        {open ? "Show less" : "Show full address"}
      </span>
    </>
  );
}
