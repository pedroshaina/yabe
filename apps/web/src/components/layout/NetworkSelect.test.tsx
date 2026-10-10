import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NetworkSelect } from "@/components/layout/NetworkSelect";

describe("NetworkSelect", () => {
  it("is a labelled dropdown with Signet selected", () => {
    render(<NetworkSelect />);
    expect(screen.getByRole("combobox", { name: "Network" })).toHaveValue("signet");
  });

  it("lists Testnet and Mainnet as options that can't be chosen", () => {
    render(<NetworkSelect />);
    const options = screen.getAllByRole("option");
    expect(options.map((o) => [o.textContent, (o as HTMLOptionElement).disabled])).toEqual([
      ["Signet", false],
      ["Testnet", true],
      ["Mainnet", true],
    ]);
  });
});
