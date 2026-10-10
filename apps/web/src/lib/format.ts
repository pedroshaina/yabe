const INTEGER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Heights and counts with en-US grouping: 318442 → "318,442". */
export function formatInteger(value: number): string {
  return INTEGER.format(value);
}

const SATS_PER_COIN = 100_000_000;

/** Satoshis as sBTC with exactly 8 decimals, using integer arithmetic (max supply < 2^53). */
export function formatSbtc(sats: number): string {
  const whole = Math.trunc(sats / SATS_PER_COIN);
  const fraction = String(sats % SATS_PER_COIN).padStart(8, "0");
  return `${formatInteger(whole)}.${fraction}`;
}

/** Bytes as B, kB (no decimals) or MB (2 decimals); 1 kB = 1000 B. */
export function formatSize(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "N min ago", "N h ago", "N d ago" (under 30 days), then YYYY-MM-DD. */
export function formatRelativeTime(unixSeconds: number, nowMs: number): string {
  const seconds = Math.floor(nowMs / 1000 - unixSeconds);
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)} min ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)} h ago`;
  if (seconds < 30 * DAY) return `${Math.floor(seconds / DAY)} d ago`;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD HH:mm UTC". */
export function formatUtc(unixSeconds: number): string {
  const iso = new Date(unixSeconds * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** "a91c…04e2": first and last 4 characters of a hash or txid. */
export function shortHash(hash: string): string {
  return hash.length <= 10 ? hash : `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

/** Weight units as "x.xx MWU" (the block limit is 4.00 MWU). */
export function formatWeight(weight: number): string {
  return `${(weight / 1_000_000).toFixed(2)} MWU`;
}

/** sat/vB with one decimal; "—" when there is none (coinbase). */
export function formatFeeRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toFixed(1)} sat/vB`;
}

const DIFFICULTY_SMALL = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });

/** Up to 4 significant digits below 1,000 (signet, regtest); grouped integers above. */
export function formatDifficulty(difficulty: number): string {
  return difficulty < 1_000
    ? DIFFICULTY_SMALL.format(difficulty)
    : formatInteger(Math.round(difficulty));
}

/** Block version as 0x-prefixed, 8 hex digits. */
export function formatVersion(version: number): string {
  return `0x${(version >>> 0).toString(16).padStart(8, "0")}`;
}

/** "1 input", "1,204 inputs". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatInteger(count)} ${count === 1 ? singular : pluralForm}`;
}

/** sBTC, or "—" when the value is unknown (a coinbase input or fee). */
export function formatSbtcOrDash(sats: number | null): string {
  return sats === null ? "—" : formatSbtc(sats);
}

/** "tb1pzczwmt…qmsj75": the start and end of a long value; values that fit are returned whole. */
export function middleEllipsis(value: string, head = 10, tail = 6): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}
