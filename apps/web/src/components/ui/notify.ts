import { toast } from "sonner";

export const CONNECTION_LOST_TOAST_ID = "chain-connection-lost";

/**
 * An in-page fetch failed; existing content stays and the user can retry. One toast per `id`:
 * a repeat failure replaces it rather than stacking another.
 */
export function notifyRetryable(title: string, retry: () => void, id: string): void {
  toast.error(title, {
    id,
    description: "Check your connection and try again.",
    action: { label: "Retry", onClick: retry },
  });
}

/** Removes a toast that no longer applies (the load succeeded, or its list went away). */
export function dismissToast(id: string): void {
  toast.dismiss(id);
}

/** Background polling has failed repeatedly; stays up until the next success. */
export function notifyConnectionLost(): void {
  toast.error("Lost connection to chain data", {
    id: CONNECTION_LOST_TOAST_ID,
    description: "Retrying in the background.",
    duration: Infinity,
  });
}

export function dismissConnectionLost(): void {
  toast.dismiss(CONNECTION_LOST_TOAST_ID);
}
