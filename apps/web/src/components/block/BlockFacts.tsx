import { FactsRow } from "@/components/ui/FactsRow";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { Block } from "@/lib/api/types";
import { formatInteger, formatSbtc } from "@/lib/format";

export function BlockFacts({ block, serverNow }: { block: Block; serverNow: number }) {
  return (
    <FactsRow
      items={[
        { label: "Mined", value: <RelativeTime time={block.time} serverNow={serverNow} /> },
        { label: "Confirmations", value: formatInteger(block.confirmations) },
        { label: "Transactions", value: formatInteger(block.txCount) },
        { label: "Reward", value: <span className="mono">{formatSbtc(block.rewardSat)}</span> },
      ]}
    />
  );
}
