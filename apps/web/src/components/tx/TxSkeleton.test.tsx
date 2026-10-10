import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TxSkeleton } from "@/components/tx/TxSkeleton";

describe("TxSkeleton", () => {
  it("names its heading while loading, with no label on the role-less wrapper", () => {
    const { container } = render(<TxSkeleton />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Loading transaction");
    expect(container.firstElementChild).not.toHaveAttribute("aria-label");
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("says the transaction is unavailable when loading failed", () => {
    const { container } = render(<TxSkeleton still />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Transaction unavailable");
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "false");
  });
});
