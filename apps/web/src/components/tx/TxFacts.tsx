import { FactsRow } from "@/components/ui/FactsRow";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Transaction } from "@/lib/api/types";
import { formatFeeRate, formatSbtcOrDash, plural } from "@/lib/format";

export function TxFacts({ tx, serverNow }: { tx: Transaction; serverNow: number }) {
  return (
    <FactsRow
      items={[
        {
          label: "Status",
          value: (
            <>
              <StatusDot />
              {plural(tx.confirmations, "confirmation")}
            </>
          ),
        },
        { label: "Fee", value: <span className="mono">{formatSbtcOrDash(tx.feeSat)}</span> },
        { label: "Fee rate", value: formatFeeRate(tx.feeRate) },
        { label: "Mined", value: <RelativeTime time={tx.blockTime} serverNow={serverNow} /> },
      ]}
    />
  );
}
