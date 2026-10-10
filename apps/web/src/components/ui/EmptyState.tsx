import type { ReactNode } from "react";
import { DashedCube } from "./icons";
import styles from "./EmptyState.module.css";

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.box}>
      <DashedCube className={styles.icon} />
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{children}</p>
    </div>
  );
}
