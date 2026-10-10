import { ChevronDownIcon } from "@/components/ui/icons";
import { CURRENT_NETWORK, NETWORKS } from "@/lib/networks";
import styles from "./NetworkSelect.module.css";

export function NetworkSelect() {
  return (
    <span className={styles.wrap}>
      <label htmlFor="network" className="visually-hidden">
        Network
      </label>
      <select id="network" className={styles.select} defaultValue={CURRENT_NETWORK.id}>
        {NETWORKS.map((network) => (
          <option key={network.id} value={network.id} disabled={!network.enabled}>
            {network.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className={styles.chevron} />
    </span>
  );
}
