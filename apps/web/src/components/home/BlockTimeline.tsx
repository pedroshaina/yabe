"use client";

import { useRef, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronDownIcon } from "@/components/ui/icons";
import { notifyRetryable } from "@/components/ui/notify";
import { fetchBlocks } from "@/lib/api/browser";
import type { BlockSummary } from "@/lib/api/types";
import { BlockCard } from "./BlockCard";
import { BlockCardSkeleton } from "./BlockCardSkeleton";
import { PAGE_SIZE } from "./constants";
import { NewBlocksPill } from "./NewBlocksPill";
import { useChainTip } from "./useChainTip";
import styles from "./BlockTimeline.module.css";
import timeline from "./Timeline.module.css";

interface Props {
  initialBlocks: BlockSummary[];
  initialNext: number | null;
  serverNow: number;
}

/** Appends `page` below `blocks`, keeping only blocks older than the oldest shown. */
function appendOlder(blocks: BlockSummary[], page: BlockSummary[]): BlockSummary[] {
  const oldest = blocks.at(-1)?.height ?? Infinity;
  return [...blocks, ...page.filter((b) => b.height < oldest)];
}

export function BlockTimeline({ initialBlocks, initialNext, serverNow }: Props) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [next, setNext] = useState(initialNext);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const busy = useRef(false);
  const busyNewer = useRef(false);
  const tip = useChainTip();
  const newest = blocks[0]?.height ?? -1;
  const newCount = tip !== null && tip > newest ? tip - newest : 0;

  async function loadOlder(): Promise<void> {
    if (busy.current || next === null) return;
    busy.current = true;
    setLoadingOlder(true);
    try {
      const page = await fetchBlocks({ limit: PAGE_SIZE, before: next });
      setBlocks((current) => appendOlder(current, page.blocks));
      setNext(page.next);
    } catch {
      notifyRetryable("Couldn't load more blocks", () => void loadOlder());
    } finally {
      busy.current = false;
      setLoadingOlder(false);
    }
  }

  async function loadNewer(): Promise<void> {
    if (busyNewer.current) return;
    busyNewer.current = true;
    setLoadingNewer(true);
    try {
      const page = await fetchBlocks({ limit: PAGE_SIZE });
      const shownNewest = blocks[0]?.height ?? -1;
      const oldestFetched = page.blocks.at(-1)?.height;
      if (oldestFetched !== undefined && oldestFetched > shownNewest + 1) {
        // More arrived than one page holds: a gap would open, so start over from the latest page.
        setBlocks(page.blocks);
        setNext(page.next);
      } else {
        setBlocks((current) => [
          ...page.blocks.filter((b) => b.height > (current[0]?.height ?? -1)),
          ...current,
        ]);
      }
    } catch {
      notifyRetryable("Couldn't load new blocks", () => void loadNewer());
    } finally {
      busyNewer.current = false;
      setLoadingNewer(false);
    }
  }

  const pill = newCount > 0 && !loadingNewer && (
    <NewBlocksPill count={newCount} onClick={() => void loadNewer()} />
  );

  if (blocks.length === 0) {
    return (
      <>
        {pill}
        {loadingNewer ? (
          <ol className={timeline.list} aria-busy="true">
            <BlockCardSkeleton />
          </ol>
        ) : (
          <EmptyState title="No blocks indexed yet">
            The indexer is still catching up with the node. Blocks will appear here as soon as they
            are indexed.
          </EmptyState>
        )}
      </>
    );
  }

  return (
    <>
      {pill}
      <ol
        className={timeline.list}
        aria-label="Latest blocks"
        aria-busy={loadingOlder || loadingNewer}
      >
        {loadingNewer && <BlockCardSkeleton key="newer" />}
        {blocks.map((block, index) => (
          <BlockCard key={block.height} block={block} newest={index === 0} serverNow={serverNow} />
        ))}
        {loadingOlder &&
          Array.from({ length: 3 }, (_, i) => <BlockCardSkeleton key={`older-${i}`} />)}
      </ol>
      {next !== null && !loadingOlder && (
        <div className={styles.more}>
          <button type="button" className={styles.moreButton} onClick={() => void loadOlder()}>
            Load older blocks
            <ChevronDownIcon />
          </button>
        </div>
      )}
    </>
  );
}
