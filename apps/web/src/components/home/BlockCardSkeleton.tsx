import { Skeleton } from "@/components/ui/Skeleton";
import { CubeMarker } from "@/components/ui/icons";
import styles from "./BlockCard.module.css";
import timeline from "./Timeline.module.css";

/** A block card's shape in grey: height and time, hash and count, fees and size. */
export function BlockCardSkeleton({ still = false }: { still?: boolean }) {
  return (
    <li className={timeline.item} aria-hidden="true">
      <div className={timeline.rail}>
        <CubeMarker className={timeline.markerEmpty} />
        <div className={timeline.line} />
      </div>
      <div className={`${styles.card} ${styles.skeleton}`}>
        <div className={styles.row}>
          <Skeleton width="96px" height={20} still={still} />
          <Skeleton width="64px" height={14} still={still} />
        </div>
        <div className={styles.row}>
          <Skeleton width="62%" height={13} still={still} />
          <Skeleton width="72px" height={13} still={still} />
        </div>
        <div className={styles.row}>
          <Skeleton width="110px" height={13} still={still} />
          <Skeleton width="56px" height={13} still={still} />
        </div>
      </div>
    </li>
  );
}
