"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DashedCube } from "@/components/ui/icons";
import { CURRENT_NETWORK } from "@/lib/networks";
import { notFoundQuery } from "@/lib/search";
import styles from "./NotFoundView.module.css";

/**
 * The not-found page. A client component because not-found.tsx receives no params: what was
 * asked for is read from the URL (a /search query, or a /block or /tx id).
 */
export function NotFoundView() {
  const { query, invalid } = notFoundQuery(usePathname(), useSearchParams().get("q"));
  return (
    <>
      <div className={styles.header}>
        <DashedCube className={styles.icon} />
        <div>
          <p className={styles.label}>Search</p>
          <h1 className={styles.title}>Not found</h1>
        </div>
      </div>
      {query !== null && (
        <p className={styles.query}>
          <code>{query}</code>
        </p>
      )}
      <div className={styles.body}>
        <p className={styles.message}>
          {invalid
            ? "This isn't a valid block height, block hash or transaction id."
            : "No block or transaction matches your search."}
        </p>
        <ul className={styles.hints}>
          <li>
            A transaction that was broadcast recently may still be waiting in the mempool. Y.A.B.E
            only shows confirmed transactions.
          </li>
          <li>Block heights go from 0 to the latest indexed block.</li>
          <li>Block hashes and transaction ids are 64 hexadecimal characters.</li>
          <li>
            It may belong to another network. You&apos;re currently on{" "}
            <strong>{CURRENT_NETWORK.label}</strong>.
          </li>
        </ul>
      </div>
      <p className={styles.back}>
        <Link href="/">← Back to latest blocks</Link>
      </p>
    </>
  );
}
