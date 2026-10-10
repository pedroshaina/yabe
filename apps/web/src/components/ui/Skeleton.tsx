import styles from "./Skeleton.module.css";

/** A grey placeholder bar. `still` stops the shimmer (used when loading has failed). */
export function Skeleton({
  width,
  height,
  still = false,
}: {
  width: string;
  height: number;
  still?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      data-skeleton=""
      className={still ? `${styles.bar} ${styles.still}` : styles.bar}
      style={{ width, height }}
    />
  );
}
