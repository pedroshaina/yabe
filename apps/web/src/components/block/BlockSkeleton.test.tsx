import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlockSkeleton } from "@/components/block/BlockSkeleton";

describe("BlockSkeleton", () => {
  it("names its heading while loading, with no label on the role-less wrapper", () => {
    const { container } = render(<BlockSkeleton />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Loading block");
    expect(container.firstElementChild).not.toHaveAttribute("aria-label");
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("says the block is unavailable when loading failed", () => {
    const { container } = render(<BlockSkeleton still />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Block unavailable");
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "false");
  });
});
