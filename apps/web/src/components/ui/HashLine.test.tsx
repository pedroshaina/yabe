import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HashLine } from "@/components/ui/HashLine";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const HASH = "0000000c91d7a2e44f08b3c5a1e96d2f7b0c38e45a19f6d2c7b80e4a3f2e3b05";

describe("HashLine", () => {
  it("shows the whole value, collapsed to one line, with a copy button", () => {
    render(<HashLine value={HASH} label="block hash" />);
    // The hash is the button's name (WCAG 2.5.3, label in name); the hint is its description.
    const toggle = screen.getByRole("button", { name: HASH });
    expect(toggle).toHaveAccessibleDescription("Show full block hash");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Copy block hash" })).toBeInTheDocument();
  });

  it("expands and collapses on click", async () => {
    const user = userEvent.setup();
    render(<HashLine value={HASH} label="block hash" />);
    const toggle = screen.getByRole("button", { name: HASH });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleDescription("Show less");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
