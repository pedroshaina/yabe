import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import type { Block } from "@/lib/api/types";
import {
  formatDifficulty,
  formatInteger,
  formatSbtc,
  formatSize,
  formatUtc,
  formatVersion,
  formatWeight,
} from "@/lib/format";

export function BlockDetails({ block }: { block: Block }) {
  return (
    <TechnicalDetails
      items={[
        {
          label: "Subsidy · Fees",
          value: `${formatSbtc(block.subsidySat)} · ${formatSbtc(block.totalFeeSat)}`,
        },
        {
          label: "Time · Median time",
          value: `${formatUtc(block.time)} · ${formatUtc(block.medianTime)}`,
        },
        {
          label: "Size · Stripped size",
          value: `${formatSize(block.size)} · ${formatSize(block.strippedSize)}`,
        },
        { label: "Weight", value: formatWeight(block.weight) },
        {
          label: "Difficulty · Bits",
          value: `${formatDifficulty(block.difficulty)} · ${block.bits}`,
        },
        {
          label: "Nonce · Version",
          value: `${formatInteger(block.nonce)} · ${formatVersion(block.version)}`,
        },
        { label: "Merkle root", value: block.merkleRoot, wide: true },
      ]}
    />
  );
}
