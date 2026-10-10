import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlowOfFunds } from "@/components/tx/FlowOfFunds";
import { TxDetails } from "@/components/tx/TxDetails";
import { TxFacts } from "@/components/tx/TxFacts";
import { TxHeader } from "@/components/tx/TxHeader";
import { TxSkeleton } from "@/components/tx/TxSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { HashLine } from "@/components/ui/HashLine";
import { getTransaction } from "@/lib/data/transaction";
import { shortHash } from "@/lib/format";
import styles from "./page.module.css";

interface Props {
  params: Promise<{ txid: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { txid } = await params;
  const loaded = await getTransaction(txid);
  return {
    title: loaded.kind === "ok" ? `Transaction ${shortHash(loaded.data.txid)}` : "Transaction",
  };
}

export default async function TransactionPage({ params }: Props) {
  const { txid } = await params;
  const loaded = await getTransaction(txid);
  if (loaded.kind === "not-found") notFound();
  if (loaded.kind === "unavailable") return <ErrorState skeleton={<TxSkeleton still />} />;

  const tx = loaded.data;
  return (
    <>
      <TxHeader tx={tx} />
      <HashLine value={tx.txid} label="transaction id" />
      <TxFacts tx={tx} serverNow={loaded.now} />
      <FlowOfFunds tx={tx} />
      <div className={styles.details}>
        <TxDetails tx={tx} />
      </div>
    </>
  );
}
