"use client";

import { useSyncExternalStore } from "react";
import { formatRelativeTime, formatUtc } from "@/lib/format";

const TICK_MS = 30_000;

function subscribe(onTick: () => void): () => void {
  const id = setInterval(onTick, TICK_MS);
  return () => clearInterval(id);
}

/** Rounded to the tick so the snapshot stays stable between ticks. */
const currentTick = (): number => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/**
 * "2 min ago", ticking every 30 s. `serverNow` is the server's render time, used while
 * hydrating so the server and client markup match.
 */
export function RelativeTime({ time, serverNow }: { time: number; serverNow: number }) {
  const now = useSyncExternalStore(subscribe, currentTick, () => serverNow);
  return (
    <time dateTime={new Date(time * 1000).toISOString()} title={formatUtc(time)}>
      {formatRelativeTime(time, now)}
    </time>
  );
}
