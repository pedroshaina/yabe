"use client";

import { useId, useState } from "react";
import { CopyButton } from "./CopyButton";
import styles from "./HashLine.module.css";

/** A hash on one line (ellipsis); tap to show it all; copy button right after it. */
export function HashLine({ value, label }: { value: string; label: string }) {
  const [open, setOpen] = useState(false);
  const hintId = useId();
  return (
    <div className={styles.line}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-describedby={hintId}
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.value}>{value}</span>
      </button>
      {/* The hash itself is the button's name (label in name); the hint says what a tap does. */}
      <span id={hintId} className="visually-hidden">
        {open ? "Show less" : `Show full ${label}`}
      </span>
      <CopyButton value={value} label={`Copy ${label}`} />
    </div>
  );
}
