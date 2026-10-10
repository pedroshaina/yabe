import { Suspense } from "react";
import { BlockTimeline } from "@/components/home/BlockTimeline";
import { PAGE_SIZE } from "@/components/home/constants";
import { HeroSearch } from "@/components/home/HeroSearch";
import { TimelineSkeleton } from "@/components/home/TimelineSkeleton";
import { ErrorToast } from "@/components/ui/ErrorToast";
import { serverApi } from "@/lib/api/server";
import type { BlocksPage } from "@/lib/api/types";
import { getLogger } from "@/lib/logger";
import styles from "./page.module.css";

type Latest = { ok: true; page: BlocksPage; now: number } | { ok: false };

async function loadLatest(): Promise<Latest> {
  try {
    const { data, response } = await serverApi().GET("/v1/blocks", {
      params: { query: { limit: String(PAGE_SIZE) } },
    });
    if (data) return { ok: true, page: data, now: Date.now() };
    getLogger().error({ status: response.status }, "the API answered /v1/blocks with an error");
  } catch (error) {
    getLogger().error({ err: error }, "could not load the latest blocks");
  }
  return { ok: false };
}

async function LatestBlocks() {
  const latest = await loadLatest();
  if (!latest.ok) {
    return (
      <>
        <TimelineSkeleton count={6} still />
        <ErrorToast
          id="home-unavailable"
          title="Can't reach the chain data right now"
          description="Try again in a moment."
        />
      </>
    );
  }
  return (
    <BlockTimeline
      initialBlocks={latest.page.blocks}
      initialNext={latest.page.next}
      serverNow={latest.now}
    />
  );
}

export default function HomePage() {
  return (
    <>
      <HeroSearch />
      <section aria-labelledby="latest-heading">
        <h2 id="latest-heading" className={styles.heading}>
          Latest blocks
        </h2>
        <Suspense fallback={<TimelineSkeleton count={6} />}>
          <LatestBlocks />
        </Suspense>
      </section>
    </>
  );
}
