import { TxCardSkeleton } from "@/components/block/TxCardSkeleton";
import { TxIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "@/components/block/BlockSkeleton.module.css";

/** The transaction page's shape in grey. `still` when loading failed. */
export function TxSkeleton({ still = false }: { still?: boolean }) {
  const cards = (n: number) => (
    <ol className={styles.list}>
      {Array.from({ length: n }, (_, i) => (
        <TxCardSkeleton key={i} still={still} />
      ))}
    </ol>
  );
  return (
    <div aria-busy={!still}>
      <PageHeader
        icon={<TxIcon />}
        label="Transaction"
        title={
          <>
            <Skeleton width="150px" height={30} still={still} />
            <span className="visually-hidden">
              {still ? "Transaction unavailable" : "Loading transaction"}
            </span>
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
        <h2>From</h2>
      </div>
      {cards(2)}
      <div className={styles.listHeading}>
        <h2>To</h2>
      </div>
      {cards(2)}
    </div>
  );
}
