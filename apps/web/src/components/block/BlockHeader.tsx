import Link from "next/link";
import { BlockIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Block } from "@/lib/api/types";
import { formatInteger } from "@/lib/format";

export function BlockHeader({ block }: { block: Block }) {
  const prev = block.height > 0 ? block.height - 1 : null;
  const next = block.nextBlockHash ? block.height + 1 : null;
  const nav =
    prev !== null || next !== null ? (
      <>
        {prev !== null && (
          <Link href={`/block/${prev}`} aria-label={`Previous block, ${formatInteger(prev)}`}>
            ←<span data-nav-word> Prev</span>
          </Link>
        )}
        {next !== null && (
          <Link href={`/block/${next}`} aria-label={`Next block, ${formatInteger(next)}`}>
            <span data-nav-word>Next </span>→
          </Link>
        )}
      </>
    ) : undefined;
  return (
    <PageHeader icon={<BlockIcon />} label="Block" title={formatInteger(block.height)} nav={nav} />
  );
}
