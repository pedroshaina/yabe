import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowOfFunds } from "@/components/tx/FlowOfFunds";
import { coinbase, tx } from "@/testing/transactions";

describe("FlowOfFunds", () => {
  it("lists inputs with their value and a link to the output they spend", () => {
    render(<FlowOfFunds tx={tx} />);
    const from = screen.getByRole("region", { name: /From/ });
    expect(within(from).getByRole("heading")).toHaveTextContent("From · 2 inputs");
    expect(within(from).getByText("0.25001410 sBTC")).toBeInTheDocument();
    expect(within(from).getByText("tb1qinputone")).toBeInTheDocument();
    expect(within(from).getByText("nonstandard")).toBeInTheDocument();
    const prevLinks = within(from).getAllByRole("link");
    expect(prevLinks[0]).toHaveAttribute("href", `/tx/${tx.inputs[0]!.prevTxid}`);
    expect(prevLinks[0]).toHaveTextContent("a91c…04e2:1");
  });

  it("shows the fee line between inputs and outputs", () => {
    render(<FlowOfFunds tx={tx} />);
    expect(screen.getByText(/Fee/)).toHaveTextContent("Fee 0.00001410 sBTC · 141 vB");
  });

  it("lists outputs with spent links, Unspent, and script types for addressless outputs", () => {
    render(<FlowOfFunds tx={tx} />);
    const to = screen.getByRole("region", { name: /To/ });
    expect(within(to).getByRole("heading")).toHaveTextContent("To · 3 outputs");
    expect(within(to).getByText("0.25000000 sBTC")).toBeInTheDocument();
    expect(within(to).getByRole("link", { name: "Spent in d04f…c18b" })).toHaveAttribute(
      "href",
      `/tx/${tx.outputs[0]!.spentBy!.txid}`,
    );
    expect(within(to).getAllByText("Unspent")).toHaveLength(2);
    expect(within(to).getByText("nulldata")).toBeInTheDocument();
    expect(within(to).getByText("0.00000000")).toBeInTheDocument();
  });

  it("shows a coinbase input as new coins, without totals or a fee", () => {
    render(<FlowOfFunds tx={coinbase} />);
    const from = screen.getByRole("region", { name: /From/ });
    expect(within(from).getByText("Coinbase (new coins)")).toBeInTheDocument();
    expect(within(from).getByRole("heading")).toHaveTextContent("From · 1 input");
    expect(within(from).queryByText(/sBTC$/)).toBeNull();
    expect(within(from).queryByRole("link")).toBeNull();
    expect(screen.getByText(/Coinbase ·/)).toHaveTextContent("Coinbase · 141 vB");
    expect(document.body.textContent).not.toMatch(/null|NaN|undefined/);
  });

  it("makes long addresses expandable and leaves script types as text", () => {
    const long = "tb1pzczwmt4kenu8j0avnhpyefp3gph32w2syuym8p8qxs5ulxudus3sqmsj75";
    render(
      <FlowOfFunds
        tx={{ ...tx, outputs: [{ ...tx.outputs[0]!, address: long }, tx.outputs[1]!] }}
      />,
    );
    const to = screen.getByRole("region", { name: /To/ });
    expect(within(to).getByRole("button", { name: long })).toBeInTheDocument();
    expect(within(to).getByText("nulldata").closest("button")).toBeNull();
  });
});
