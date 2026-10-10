"use client";

import { useState, useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { applyTheme, otherTheme, type Theme } from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const systemTheme = (): Theme => (window.matchMedia(DARK_QUERY).matches ? "dark" : "light");
const serverTheme = (): Theme => "light";

/** `initialTheme` is the stored choice the server read from the cookie, if any. */
export function ThemeToggle({ initialTheme }: { initialTheme?: Theme }) {
  const [chosen, setChosen] = useState(initialTheme);
  const system = useSyncExternalStore(subscribe, systemTheme, serverTheme);
  const next = otherTheme(chosen ?? system);

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
        setChosen(next);
      }}
    >
      <SunIcon className={styles.sun} />
      <MoonIcon className={styles.moon} />
    </button>
  );
}
