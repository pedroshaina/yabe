import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroSearch } from "@/components/home/HeroSearch";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const HINT = "Enter a block height, block hash or transaction id";

describe("HeroSearch", () => {
  beforeEach(() => push.mockClear());

  it("has a labelled search field and a Search button", () => {
    render(<HeroSearch />);
    expect(
      screen.getByRole("heading", { name: "Explore the bitcoin blockchain" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveAttribute(
      "placeholder",
      "Height, block hash or txid",
    );
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("navigates to the search for a trimmed height", async () => {
    const user = userEvent.setup();
    render(<HeroSearch />);
    await user.type(screen.getByRole("searchbox"), "  318442 {Enter}");
    expect(push).toHaveBeenCalledWith("/search?q=318442");
  });

  it("navigates for a 64-character hash", async () => {
    const user = userEvent.setup();
    render(<HeroSearch />);
    await user.type(screen.getByRole("searchbox"), "A".repeat(64));
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith(`/search?q=${"A".repeat(64)}`);
  });

  it.each([["318442abc"], ["12345678901"], ["   "]])(
    "shows the hint for %j and stays put",
    async (value) => {
      const user = userEvent.setup();
      render(<HeroSearch />);
      const input = screen.getByRole("searchbox");
      await user.type(input, `${value}{Enter}`);
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByText(HINT)).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription(HINT);
    },
  );

  it("clears the hint as soon as the user edits the field", async () => {
    const user = userEvent.setup();
    render(<HeroSearch />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "abc{Enter}");
    await user.type(input, "d");
    expect(screen.queryByText(HINT)).toBeNull();
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});
