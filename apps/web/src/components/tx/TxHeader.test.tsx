import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TxHeader } from "@/components/tx/TxHeader";
import { TxFacts } from "@/components/tx/TxFacts";
import { coinbase, tx } from "@/testing/transactions";

describe("TxHeader", () => {
  it("shows the position and links to its block by height", () => {
    render(<TxHeader tx={tx} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("#14");
    expect(screen.getByText(/in block/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "318,440" })).toHaveAttribute("href", "/block/318440");
  });
});

describe("TxFacts", () => {
  it("shows status, fee, fee rate and time", () => {
    render(<TxFacts tx={tx} serverNow={tx.blockTime * 1000 + 19 * 60_000} />);
    expect(screen.getByText("3 confirmations")).toBeInTheDocument();
    expect(screen.getByText("0.00001410")).toBeInTheDocument();
    expect(screen.getByText("10.0 sat/vB")).toBeInTheDocument();
  });

  it("says 1 confirmation, and dashes for a coinbase's fee and rate", () => {
    render(<TxFacts tx={{ ...coinbase, confirmations: 1 }} serverNow={0} />);
    expect(screen.getByText("1 confirmation")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
