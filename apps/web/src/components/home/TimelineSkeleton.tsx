import { BlockCardSkeleton } from "./BlockCardSkeleton";
import timeline from "./Timeline.module.css";

/** The page-level placeholder for the timeline. `still` when loading has failed. */
export function TimelineSkeleton({ count, still = false }: { count: number; still?: boolean }) {
  return (
    <ol className={timeline.list} aria-busy={!still} aria-label="Loading latest blocks">
      {Array.from({ length: count }, (_, i) => (
        <BlockCardSkeleton key={i} still={still} />
      ))}
    </ol>
  );
}
