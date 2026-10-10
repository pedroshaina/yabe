"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import styles from "./HashLine.module.css";

/** A hash on one line (ellipsis); tap to show it all; copy button right after it. */
export function HashLine({ value, label }: { value: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.line}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-label={open ? "Show less" : `Show full ${label}`}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.value}>{value}</span>
      </button>
      <CopyButton value={value} label={`Copy ${label}`} />
    </div>
  );
}
