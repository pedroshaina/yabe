import type { Metadata } from "next";
import { Suspense } from "react";
import { NotFoundView } from "@/components/notfound/NotFoundView";

export const metadata: Metadata = { title: "Not found" };

/** Every notFound() and every unknown URL. */
export default function NotFound() {
  return (
    // NotFoundView reads search params; the boundary keeps that legal if this is ever prerendered.
    <Suspense>
      <NotFoundView />
    </Suspense>
  );
}
