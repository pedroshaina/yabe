import { ArrowUpIcon } from "@/components/ui/icons";
import styles from "./NewBlocksPill.module.css";

export function NewBlocksPill({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.pill} onClick={onClick}>
        <ArrowUpIcon />
        {count === 1 ? "1 new block" : `${count} new blocks`}
      </button>
    </div>
  );
}
