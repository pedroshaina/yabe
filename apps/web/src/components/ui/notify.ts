import { toast } from "sonner";

export const CONNECTION_LOST_TOAST_ID = "chain-connection-lost";

/** An in-page fetch failed; existing content stays and the user can retry. */
export function notifyRetryable(title: string, retry: () => void): void {
  toast.error(title, {
    description: "Check your connection and try again.",
    action: { label: "Retry", onClick: retry },
  });
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
