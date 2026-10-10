"use client";

import { useRef, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronDownIcon } from "@/components/ui/icons";
import { notifyRetryable } from "@/components/ui/notify";
import { fetchBlocks } from "@/lib/api/browser";
import type { BlockSummary } from "@/lib/api/types";
import { BlockCard } from "./BlockCard";
import { BlockCardSkeleton } from "./BlockCardSkeleton";
import styles from "./BlockTimeline.module.css";
import timeline from "./Timeline.module.css";

export const PAGE_SIZE = 10;

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
  const busy = useRef(false);

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

  if (blocks.length === 0) {
    return (
      <EmptyState title="No blocks indexed yet">
        The indexer is still catching up with the node. Blocks will appear here as soon as they are
        indexed.
      </EmptyState>
    );
  }

  return (
    <>
      <ol className={timeline.list} aria-label="Latest blocks" aria-busy={loadingOlder}>
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
