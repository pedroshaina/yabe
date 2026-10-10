import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SearchSkeleton } from "@/components/notfound/SearchSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { getSearch } from "@/lib/data/search";

interface Props {
  searchParams: Promise<{ q?: string | string[] }>;
}

async function search({ searchParams }: Props) {
  const { q } = await searchParams;
  return getSearch((Array.isArray(q) ? q[0] : q) ?? "");
}

// The page's title wins over not-found.tsx's, so it has to say "Not found" itself.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const outcome = await search(props);
  return { title: outcome.kind === "not-found" ? "Not found" : "Search" };
}

/**
 * No loading.tsx on purpose: nothing streams before the API answers, so redirect() is a real 307
 * and notFound() a real 404 (unlike the streamed /block and /tx pages, spec §13).
 */
export default async function SearchPage(props: Props) {
  const outcome = await search(props);
  if (outcome.kind === "block") redirect(`/block/${outcome.height}`);
  if (outcome.kind === "transaction") redirect(`/tx/${outcome.txid}`);
  if (outcome.kind === "not-found") notFound();
  return <ErrorState skeleton={<SearchSkeleton />} />;
}
