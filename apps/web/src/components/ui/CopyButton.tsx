"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon } from "./icons";
import styles from "./CopyButton.module.css";

const CONFIRM_MS = 2_000;

/** Copies `value`; confirms with a check and a polite "Copied", or a toast if the clipboard refuses. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      // Missing on insecure origins (plain http on a LAN address).
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon className={styles.done} /> : <CopyIcon />}
      </button>
      <span role="status" className="visually-hidden">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}
