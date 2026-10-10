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
