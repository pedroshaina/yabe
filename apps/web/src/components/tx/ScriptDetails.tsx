"use client";

import { useState } from "react";
import type { Transaction } from "@/lib/api/types";
import styles from "./ScriptDetails.module.css";

/** "Show asm": every input's scriptSig asm (or coinbase data) and witness, every output's script asm. */
export function ScriptDetails({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide asm" : "Show asm"}
      </button>
      {open && (
        <div className={styles.scripts}>
          <h3 className={styles.heading}>Inputs</h3>
          {tx.inputs.map((input) => (
            <div key={input.index} className={styles.script}>
              <p className={styles.name}>{`Input ${input.index}`}</p>
              <pre className={styles.asm}>{input.coinbaseHex ?? (input.scriptSig?.asm || "—")}</pre>
              {input.witness.map((item, i) => (
                <pre key={i} className={styles.asm}>
                  {item}
                </pre>
              ))}
            </div>
          ))}
          <h3 className={styles.heading}>Outputs</h3>
          {tx.outputs.map((output) => (
            <div key={output.index} className={styles.script}>
              <p className={styles.name}>{`Output ${output.index}`}</p>
              <pre className={styles.asm}>{output.script.asm || "—"}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
