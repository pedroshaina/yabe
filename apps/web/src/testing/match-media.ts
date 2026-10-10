import { vi } from "vitest";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** jsdom has no matchMedia; stub it to report the given system colour scheme. */
export function mockSystemTheme(dark: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query === DARK_QUERY,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
