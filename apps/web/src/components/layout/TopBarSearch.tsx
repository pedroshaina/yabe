"use client";

import { usePathname } from "next/navigation";
import { SearchIcon } from "@/components/ui/icons";
import { SEARCH_HINT, useSearchForm } from "@/components/search/useSearchForm";
import styles from "./TopBarSearch.module.css";

/** The compact search on inner pages. Home has the hero search instead. */
export function TopBarSearch() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  // A new key per page: the box starts empty, without a stale hint, after every navigation.
  return <TopBarSearchForm key={pathname} />;
}

function TopBarSearchForm() {
  const { hintId, invalid, pending, onSubmit, inputProps } = useSearchForm();
  return (
    <div className={styles.wrap}>
      <form
        className={styles.form}
        role="search"
        aria-busy={pending || undefined}
        onSubmit={onSubmit}
        noValidate
      >
        <SearchIcon className={styles.icon} />
        <label htmlFor="top-search" className="visually-hidden">
          Search
        </label>
        <input
          id="top-search"
          className={styles.input}
          placeholder="Height, hash or txid"
          {...inputProps}
        />
      </form>
      {invalid && (
        <p id={hintId} className={styles.hint} role="alert">
          {SEARCH_HINT}
        </p>
      )}
      {/* No button to relabel here, so "Searching…" shows in the hint's popover spot. */}
      <p
        role="status"
        className={pending ? `${styles.hint} ${styles.searching}` : "visually-hidden"}
      >
        {pending ? "Searching…" : ""}
      </p>
    </div>
  );
}
