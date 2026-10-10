import type { Metadata } from "next";
import { Suspense } from "react";
import { NotFoundView } from "@/components/notfound/NotFoundView";
import { getHintTipHeight } from "@/lib/data/tip";

export const metadata: Metadata = { title: "Not found" };

/** Every notFound() and every unknown URL. */
export default async function NotFound() {
  const tipHeight = await getHintTipHeight();
  return (
    // NotFoundView reads search params; the boundary keeps that legal if this is ever prerendered.
    <Suspense>
      <NotFoundView tipHeight={tipHeight} />
    </Suspense>
  );
}
