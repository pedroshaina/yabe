"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronDownIcon } from "@/components/ui/icons";
import { dismissToast, notifyRetryable } from "@/components/ui/notify";
import { fetchBlockTransactions } from "@/lib/api/browser";
import type { TxSummary } from "@/lib/api/types";
import { TX_PAGE_SIZE } from "@/lib/api/constants";
import { TxCard } from "./TxCard";
import { TxCardSkeleton } from "./TxCardSkeleton";
import styles from "./TransactionList.module.css";

const MORE_TOAST_ID = "load-more-transactions";

interface Props {
  blockHash: string;
  initialTransactions: TxSummary[];
  initialNext: number | null;
}

export function TransactionList({ blockHash, initialTransactions, initialNext }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [next, setNextState] = useState(initialNext);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  // The current cursor for async callbacks: a page requested with an older cursor (a stale
  // Retry) must not be appended, and a Retry should load from where the list is now.
  const nextRef = useRef(initialNext);
  function setNext(value: number | null) {
    nextRef.current = value;
    setNextState(value);
  }
  // A failure toast belongs to this block's list: Prev/Next remounts the list and takes it along.
  useEffect(() => () => dismissToast(MORE_TOAST_ID), []);

  async function loadMore(): Promise<void> {
    const cursor = nextRef.current;
    if (busy.current || cursor === null) return;
    busy.current = true;
    setLoading(true);
    try {
      const page = await fetchBlockTransactions({
        hash: blockHash,
        after: cursor,
        limit: TX_PAGE_SIZE,
      });
      if (nextRef.current !== cursor) return;
      setTransactions((current) => {
        const last = current.at(-1)?.position ?? -1;
        return [...current, ...page.transactions.filter((t) => t.position > last)];
      });
      setNext(page.next);
      dismissToast(MORE_TOAST_ID);
    } catch {
      notifyRetryable("Couldn't load more transactions", () => void loadMore(), MORE_TOAST_ID);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="transactions-heading">
      <div className={styles.heading}>
        <h2 id="transactions-heading" className={styles.title}>
          Transactions
        </h2>
        <span className={styles.note}>Amounts in sBTC</span>
      </div>
      {transactions.length === 0 ? (
        <EmptyState title="No transactions in this block">
          There is nothing to list here.
        </EmptyState>
      ) : (
        <ol className={styles.list} aria-busy={loading}>
          {transactions.map((tx) => (
            <TxCard key={tx.position} tx={tx} />
          ))}
          {loading && Array.from({ length: 3 }, (_, i) => <TxCardSkeleton key={`more-${i}`} />)}
        </ol>
      )}
      {next !== null && transactions.length > 0 && (
        <button
          type="button"
          className={styles.more}
          aria-disabled={loading || undefined}
          onClick={() => void loadMore()}
        >
          Load more transactions
          <ChevronDownIcon />
        </button>
      )}
    </section>
  );
}
