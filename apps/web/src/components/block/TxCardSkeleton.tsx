import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./TxCard.module.css";

export function TxCardSkeleton({ still = false }: { still?: boolean }) {
  return (
    <li aria-hidden="true">
      <div className={`${styles.card} ${styles.skeleton}`}>
        <div className={styles.row}>
          <Skeleton width="65%" height={14} still={still} />
          <Skeleton width="90px" height={14} still={still} />
        </div>
        <div className={styles.row}>
          <Skeleton width="120px" height={12} still={still} />
          <Skeleton width="80px" height={12} still={still} />
        </div>
      </div>
    </li>
  );
}
