"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/** Raises a persistent toast while mounted; Retry re-renders the page on the server. */
export function ErrorToast({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  useEffect(() => {
    toast.error(title, {
      id,
      description,
      duration: Infinity,
      action: {
        label: "Retry",
        onClick: (event) => {
          // Keep the toast up: if the API is still down after the refresh, this component stays
          // mounted with the same props and wouldn't raise it again.
          event.preventDefault();
          router.refresh();
        },
      },
    });
    return () => {
      toast.dismiss(id);
    };
  }, [id, title, description, router]);
  return null;
}
