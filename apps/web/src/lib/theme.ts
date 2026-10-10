export type Theme = "light" | "dark";

export const THEME_COOKIE = "yabe-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The stored choice, or undefined (follow the system) for anything else, including tampered values. */
export function parseTheme(value: string | undefined): Theme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Shows `theme` now and remembers it for server renders. Browser-only. */
export function applyTheme(theme: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  doc.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
