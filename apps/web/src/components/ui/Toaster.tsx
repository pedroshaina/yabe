"use client";

import { Toaster as Sonner } from "sonner";
import { WarningIcon } from "./icons";
import styles from "./Toaster.module.css";

/** Sonner, unstyled, dressed in our tokens. Bottom-right on desktop; full width on phones. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      icons={{ error: <WarningIcon className={styles.warning} /> }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: styles.toast,
          icon: styles.icon,
          content: styles.content,
          title: styles.title,
          description: styles.description,
          actionButton: styles.action,
          closeButton: styles.close,
        },
      }}
    />
  );
}
