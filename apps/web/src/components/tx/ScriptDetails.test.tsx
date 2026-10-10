import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ScriptDetails } from "@/components/tx/ScriptDetails";
import { coinbase, tx } from "@/testing/transactions";

describe("ScriptDetails", () => {
  it("reveals each script's asm and witness on demand", async () => {
    const user = userEvent.setup();
    render(<ScriptDetails tx={tx} />);
    expect(screen.queryByText("OP_RETURN 68656c6c6f")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show asm" }));
    expect(screen.getByRole("button", { name: "Hide asm" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("OP_1")).toBeInTheDocument();
    expect(screen.getByText("3044aa")).toBeInTheDocument();
    expect(screen.getByText("OP_RETURN 68656c6c6f")).toBeInTheDocument();
  });

  it("shows the coinbase data for a coinbase input", async () => {
    const user = userEvent.setup();
    render(<ScriptDetails tx={coinbase} />);
    await user.click(screen.getByRole("button", { name: "Show asm" }));
    expect(screen.getByText("03e8db04")).toBeInTheDocument();
  });
});
