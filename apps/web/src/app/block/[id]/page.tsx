import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockDetails } from "@/components/block/BlockDetails";
import { BlockFacts } from "@/components/block/BlockFacts";
import { BlockHeader } from "@/components/block/BlockHeader";
import { BlockSkeleton } from "@/components/block/BlockSkeleton";
import { TransactionList } from "@/components/block/TransactionList";
import { ErrorState } from "@/components/ui/ErrorState";
import { HashLine } from "@/components/ui/HashLine";
import { getBlock } from "@/lib/data/block";
import { formatInteger } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const loaded = await getBlock(id);
  return {
    title: loaded.kind === "ok" ? `Block ${formatInteger(loaded.data.block.height)}` : "Block",
  };
}

export default async function BlockPage({ params }: Props) {
  const { id } = await params;
  const loaded = await getBlock(id);
  if (loaded.kind === "not-found") notFound();
  if (loaded.kind === "unavailable") return <ErrorState skeleton={<BlockSkeleton still />} />;

  const { block, transactions } = loaded.data;
  return (
    <>
      <BlockHeader block={block} />
      <HashLine value={block.hash} label="block hash" />
      <BlockFacts block={block} serverNow={loaded.now} />
      <BlockDetails block={block} />
      <TransactionList
        key={block.hash}
        blockHash={block.hash}
        initialTransactions={transactions.transactions}
        initialNext={transactions.next}
      />
    </>
  );
}
