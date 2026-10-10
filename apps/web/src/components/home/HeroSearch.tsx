"use client";

import { LogoMark, SearchIcon } from "@/components/ui/icons";
import { SEARCH_HINT, useSearchForm } from "@/components/search/useSearchForm";
import styles from "./HeroSearch.module.css";

export function HeroSearch() {
  const { hintId, invalid, pending, onSubmit, inputProps } = useSearchForm();
  return (
    <section className={styles.hero}>
      <LogoMark className={styles.mark} />
      <h1 className={styles.title}>Explore the bitcoin blockchain</h1>
      <form
        className={styles.form}
        role="search"
        aria-busy={pending || undefined}
        onSubmit={onSubmit}
        noValidate
      >
        <SearchIcon className={styles.icon} />
        <label htmlFor="hero-search" className="visually-hidden">
          Search
        </label>
        <input
          id="hero-search"
          className={styles.input}
          placeholder="Height, block hash or txid"
          {...inputProps}
        />
        <button type="submit" className={styles.button} aria-disabled={pending || undefined}>
          {pending ? "Searching…" : "Search"}
        </button>
      </form>
      <p role="status" className="visually-hidden">
        {pending ? "Searching…" : ""}
      </p>
      {invalid && (
        <p id={hintId} className={styles.hint} role="alert">
          {SEARCH_HINT}
        </p>
      )}
    </section>
  );
}
