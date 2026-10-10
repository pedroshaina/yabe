import { BlockIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TxCardSkeleton } from "./TxCardSkeleton";
import styles from "./BlockSkeleton.module.css";

/** The block page's shape in grey. `still` when loading failed. */
export function BlockSkeleton({ still = false }: { still?: boolean }) {
  return (
    <div aria-busy={!still}>
      <PageHeader
        icon={<BlockIcon />}
        label="Block"
        title={
          <>
            <Skeleton width="150px" height={30} still={still} />
            <span className="visually-hidden">{still ? "Block unavailable" : "Loading block"}</span>
          </>
        }
      />
      <div className={styles.hash}>
        <Skeleton width="88%" height={18} still={still} />
      </div>
      <div className={styles.facts}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.fact}>
            <Skeleton width="70px" height={12} still={still} />
            <Skeleton width="110px" height={18} still={still} />
          </div>
        ))}
      </div>
      <div className={styles.listHeading}>
        <h2>Transactions</h2>
      </div>
      <ol className={styles.list}>
        {Array.from({ length: 5 }, (_, i) => (
          <TxCardSkeleton key={i} still={still} />
        ))}
      </ol>
    </div>
  );
}
