import { describe, expect, it } from "vitest";
import { CURRENT_NETWORK, NETWORKS } from "@/lib/networks";

describe("networks", () => {
  it("lists Signet, Testnet and Mainnet in that order", () => {
    expect(NETWORKS.map((n) => n.label)).toEqual(["Signet", "Testnet", "Mainnet"]);
  });

  it("enables only Signet", () => {
    expect(NETWORKS.filter((n) => n.enabled).map((n) => n.id)).toEqual(["signet"]);
  });

  it("selects Signet", () => {
    expect(CURRENT_NETWORK).toEqual({ id: "signet", label: "Signet", enabled: true });
  });
});
