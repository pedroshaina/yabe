import { DashedCube } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./NotFoundView.module.css";

/** The search page while the API is unavailable: still, shown under the "can't reach" toast. */
export function SearchSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={styles.header}>
        <DashedCube className={styles.icon} />
        <div>
          <p className={styles.label}>Search</p>
          <Skeleton width="160px" height={30} still />
        </div>
      </div>
      <div className={styles.body}>
        <Skeleton width="70%" height={18} still />
      </div>
    </div>
  );
}
