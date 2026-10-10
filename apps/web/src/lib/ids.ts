const HEIGHT = /^\d{1,10}$/;
const HASH = /^[0-9a-fA-F]{64}$/;

/** A block URL id: a height (1–10 digits) or a 64-hex block hash. */
export function isBlockId(id: string): boolean {
  return HEIGHT.test(id) || HASH.test(id);
}

/** A transaction id: 64 hex characters. */
export function isTxid(id: string): boolean {
  return HASH.test(id);
}
