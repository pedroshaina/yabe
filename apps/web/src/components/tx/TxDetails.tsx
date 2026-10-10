import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import type { Transaction } from "@/lib/api/types";
import { formatInteger, formatSize } from "@/lib/format";
import { ScriptDetails } from "./ScriptDetails";

export function TxDetails({ tx }: { tx: Transaction }) {
  return (
    <TechnicalDetails
      items={[
        { label: "Size", value: formatSize(tx.size) },
        { label: "Weight", value: `${formatInteger(tx.weight)} WU` },
        { label: "Version", value: String(tx.version) },
        { label: "Locktime", value: formatInteger(tx.locktime) },
      ]}
    >
      <ScriptDetails tx={tx} />
    </TechnicalDetails>
  );
}
