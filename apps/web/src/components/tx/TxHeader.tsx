import Link from "next/link";
import { TxIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Transaction } from "@/lib/api/types";
import { formatInteger } from "@/lib/format";

export function TxHeader({ tx }: { tx: Transaction }) {
  return (
    <PageHeader
      icon={<TxIcon />}
      label="Transaction"
      title={`#${formatInteger(tx.position)}`}
      aside={
        <>
          in block{" "}
          <Link href={`/block/${tx.blockHeight}`} className="mono">
            {formatInteger(tx.blockHeight)}
          </Link>
        </>
      }
    />
  );
}
