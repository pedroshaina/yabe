import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

interface Props {
  icon: ReactNode;
  label: string;
  title: ReactNode;
  aside?: ReactNode;
  nav?: ReactNode;
}

/** Icon, small label, big mono title (+ something beside it), optional navigation on the right. */
export function PageHeader({ icon, label, title, aside, nav }: Props) {
  return (
    <div className={styles.header}>
      <div className={styles.identity}>
        <span className={styles.icon}>{icon}</span>
        <div>
          <p className={styles.label}>{label}</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {aside && <span className={styles.aside}>{aside}</span>}
          </div>
        </div>
      </div>
      {nav && (
        <nav className={styles.nav} aria-label="Neighbouring blocks">
          {nav}
        </nav>
      )}
    </div>
  );
}
