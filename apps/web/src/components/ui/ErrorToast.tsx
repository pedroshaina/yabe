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
      action: { label: "Retry", onClick: () => router.refresh() },
    });
    return () => {
      toast.dismiss(id);
    };
  }, [id, title, description, router]);
  return null;
}
