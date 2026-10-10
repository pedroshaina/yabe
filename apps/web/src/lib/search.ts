import { isBlockId, isTxid } from "@/lib/ids";

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

export interface NotFoundQuery {
  /** What the visitor asked for, as they typed it (trimmed for searches); null when there's nothing to show. */
  query: string | null;
  /** True when it can't be a height, hash or txid at all. */
  invalid: boolean;
}

const ID_PATH = /^\/(block|tx)\/([^/]+)$/;

/** What a not-found page was asked for, read from its URL: a /search query or a /block or /tx id. */
export function notFoundQuery(pathname: string, q: string | null): NotFoundQuery {
  if (pathname === "/search") {
    const query = (q ?? "").trim();
    return { query: query || null, invalid: classifyQuery(query).kind === "invalid" };
  }
  const match = ID_PATH.exec(pathname);
  if (!match) return { query: null, invalid: false };
  const route = match[1];
  const segment = match[2]!;
  let id = segment;
  try {
    id = decodeURIComponent(segment);
  } catch {
    // A malformed escape (%ZZ): show it as it was typed.
  }
  return { query: id, invalid: route === "block" ? !isBlockId(id) : !isTxid(id) };
}
