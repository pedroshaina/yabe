export type QueryKind = { kind: "height" | "hash"; value: string } | { kind: "invalid" };

const HEIGHT = /^\d{1,10}$/;
const HASH = /^[0-9a-fA-F]{64}$/;

/** What a search box value can be: a block height, a 64-hex block hash or txid, or neither. */
export function classifyQuery(raw: string): QueryKind {
  const value = raw.trim();
  if (HEIGHT.test(value)) return { kind: "height", value };
  if (HASH.test(value)) return { kind: "hash", value };
  return { kind: "invalid" };
}

export function searchHref(value: string): string {
  return `/search?q=${encodeURIComponent(value)}`;
}
