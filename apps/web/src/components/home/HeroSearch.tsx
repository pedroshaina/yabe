"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { LogoMark, SearchIcon } from "@/components/ui/icons";
import { classifyQuery, searchHref } from "@/lib/search";
import styles from "./HeroSearch.module.css";

const HINT = "Enter a block height, block hash or transaction id";

export function HeroSearch() {
  const router = useRouter();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = classifyQuery(value);
    if (query.kind === "invalid") {
      setInvalid(true);
      return;
    }
    router.push(searchHref(query.value));
  }

  return (
    <section className={styles.hero}>
      <LogoMark className={styles.mark} />
      <h1 className={styles.title}>Explore the bitcoin blockchain</h1>
      <form className={styles.form} role="search" onSubmit={submit} noValidate>
        <SearchIcon className={styles.icon} />
        <label htmlFor="hero-search" className="visually-hidden">
          Search
        </label>
        <input
          id="hero-search"
          className={styles.input}
          type="search"
          placeholder="Height, block hash or txid"
          autoComplete="off"
          spellCheck={false}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? hintId : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
        />
        <button type="submit" className={styles.button}>
          Search
        </button>
      </form>
      {invalid && (
        <p id={hintId} className={styles.hint} role="alert">
          {HINT}
        </p>
      )}
    </section>
  );
}
