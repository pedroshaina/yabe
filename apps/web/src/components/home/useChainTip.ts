"use client";

import { useEffect, useState } from "react";
import { dismissConnectionLost, notifyConnectionLost } from "@/components/ui/notify";
import { fetchTip } from "@/lib/api/browser";

export const POLL_INTERVAL_MS = 30_000;
export const FAILURES_BEFORE_NOTICE = 3;

/**
 * The latest indexed height, polled every 30 s while the tab is visible and once when it
 * becomes visible again. null until the first answer, or while nothing is indexed.
 */
export function useChainTip(): number | null {
  const [tip, setTip] = useState<number | null>(null);

  useEffect(() => {
    let failures = 0;
    let stopped = false;
    let inFlight = false;

    async function poll(): Promise<void> {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        const current = await fetchTip();
        if (stopped) return;
        if (failures >= FAILURES_BEFORE_NOTICE) dismissConnectionLost();
        failures = 0;
        setTip(current?.height ?? null);
      } catch {
        failures += 1;
        if (failures === FAILURES_BEFORE_NOTICE) notifyConnectionLost();
      } finally {
        inFlight = false;
      }
    }

    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return tip;
}
