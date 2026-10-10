import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlockHeader } from "@/components/block/BlockHeader";
import type { Block } from "@/lib/api/types";

const base: Block = {
  height: 318440,
  hash: "0".repeat(64),
  prevHash: "1".repeat(64),
  nextBlockHash: "2".repeat(64),
  confirmations: 3,
  merkleRoot: "3".repeat(64),
  version: 0x20000000,
  bits: "1e0377ae",
  nonce: 1,
  difficulty: 0.0026,
  time: 1,
  medianTime: 1,
  size: 1,
  strippedSize: 1,
  weight: 1,
  txCount: 1,
  subsidySat: 1,
  totalFeeSat: 0,
  rewardSat: 1,
};

describe("BlockHeader", () => {
  it("shows the height and links to both neighbours by height", () => {
    render(<BlockHeader block={base} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("318,440");
    expect(screen.getByRole("link", { name: "Previous block, 318,439" })).toHaveAttribute(
      "href",
      "/block/318439",
    );
    expect(screen.getByRole("link", { name: "Next block, 318,441" })).toHaveAttribute(
      "href",
      "/block/318441",
    );
  });

  it("has no Prev link on the genesis block", () => {
    render(<BlockHeader block={{ ...base, height: 0, prevHash: null }} />);
    expect(screen.queryByRole("link", { name: /Previous block/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Next block, 1" })).toBeInTheDocument();
  });

  it("has no Next link on the tip", () => {
    render(<BlockHeader block={{ ...base, nextBlockHash: null }} />);
    expect(screen.queryByRole("link", { name: /Next block/ })).toBeNull();
  });
});
