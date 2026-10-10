import { ArrowUpIcon } from "@/components/ui/icons";
import styles from "./NewBlocksPill.module.css";

/** Stays mounted while `busy` so keyboard focus isn't lost; the caller ignores repeat clicks. */
export function NewBlocksPill({
  count,
  busy,
  onClick,
}: {
  count: number;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.pill}
        aria-disabled={busy || undefined}
        onClick={onClick}
      >
        <ArrowUpIcon />
        {count === 1 ? "1 new block" : `${count} new blocks`}
      </button>
    </div>
  );
}
