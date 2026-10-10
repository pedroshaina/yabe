import { serverApi } from "@/lib/api/server";
import { formatInteger } from "@/lib/format";
import { getLogger } from "@/lib/logger";
import styles from "./page.module.css";

type TipState = { kind: "tip"; height: number } | { kind: "empty" } | { kind: "unavailable" };

async function loadTip(): Promise<TipState> {
  try {
    const { data, response } = await serverApi().GET("/v1/status");
    if (!data) {
      getLogger().error({ status: response.status }, "the API answered /v1/status with an error");
      return { kind: "unavailable" };
    }
    return data.tip ? { kind: "tip", height: data.tip.height } : { kind: "empty" };
  } catch (error) {
    getLogger().error({ err: error }, "could not load the chain tip");
    return { kind: "unavailable" };
  }
}

/** Phase 1 shell; phase 2 replaces it with the hero search and block timeline. */
export default async function HomePage() {
  const tip = await loadTip();
  return (
    <section className={styles.hero}>
      <h1 className={styles.title}>Explore the bitcoin blockchain</h1>
      <p className={styles.status}>
        {tip.kind === "tip" && <>Latest block {formatInteger(tip.height)}</>}
        {tip.kind === "empty" && "No blocks indexed yet."}
        {tip.kind === "unavailable" && "Can't reach the chain data right now."}
      </p>
    </section>
  );
}
