import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TxCard } from "@/components/block/TxCard";
import type { TxSummary } from "@/lib/api/types";

const TXID = "e07a33f81c5d92b40e6a7c18d3f5b2e09a4c71d6e83b5f20c9a1d47e6f35c19b8";
const tx: TxSummary = {
  txid: TXID,
  position: 1,
  isCoinbase: false,
  feeSat: 2820,
  vsize: 141,
  inputCount: 1,
  outputCount: 2,
  totalInSat: 48_212_820,
  totalOutSat: 48_210_000,
};

function renderCard(t: TxSummary) {
  return render(
    <ol>
      <TxCard tx={t} />
    </ol>,
  );
}

describe("TxCard", () => {
  it("links to the transaction and shows position, txid, total out, shape and fee", () => {
    renderCard(tx);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/tx/${TXID}`);
    expect(within(link).getByText("1")).toBeInTheDocument();
    expect(within(link).getByText(TXID)).toBeInTheDocument();
    expect(within(link).getByText("0.48210000")).toBeInTheDocument();
    expect(within(link).getByText("1 input → 2 outputs")).toBeInTheDocument();
    expect(within(link).getByText("Fee 0.00002820")).toBeInTheDocument();
    expect(within(link).queryByText("coinbase")).toBeNull();
  });

  it("marks the coinbase instead of showing a fee", () => {
    renderCard({
      ...tx,
      position: 0,
      isCoinbase: true,
      feeSat: null,
      totalInSat: null,
      inputCount: 1,
      outputCount: 1,
    });
    const link = screen.getByRole("link");
    expect(within(link).getByText("coinbase")).toBeInTheDocument();
    expect(within(link).getByText("1 input → 1 output")).toBeInTheDocument();
    expect(within(link).queryByText(/^Fee/)).toBeNull();
  });
});
