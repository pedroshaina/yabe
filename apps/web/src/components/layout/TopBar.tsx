import Link from "next/link";
import { LogoMark } from "@/components/ui/icons";
import type { Theme } from "@/lib/theme";
import { NetworkSelect } from "./NetworkSelect";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./TopBar.module.css";

/** `theme` is the stored choice from the cookie, if any. */
export function TopBar({ theme }: { theme?: Theme }) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Y.A.B.E home">
          <LogoMark className={styles.mark} />
          <span className={styles.wordmark}>Y.A.B.E</span>
        </Link>
        <div className={styles.controls}>
          <NetworkSelect />
          <ThemeToggle initialTheme={theme} />
        </div>
      </div>
    </header>
  );
}
