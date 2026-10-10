import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockCard } from "@/components/home/BlockCard";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const block = {
  height: 318442,
  hash: "0000000a3f5be1d0c27e8f94a6b3d1e07c5a2f8d6e4b9c0a7f3e1d2b5c891c4e",
  time: NOW / 1000 - 120,
  txCount: 1204,
  size: 412_000,
  weight: 1_640_000,
  totalFeeSat: 182_340,
};

function renderCard(newest = false) {
  return render(
    <ol>
      <BlockCard block={block} newest={newest} serverNow={NOW} />
    </ol>,
  );
}

describe("BlockCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("links to the block by height", () => {
    renderCard();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/block/318442");
  });

  it("shows height, time, hash, transactions, size and fees", () => {
    renderCard();
    const card = screen.getByRole("link");
    expect(within(card).getAllByText("318,442").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("2 min ago").length).toBeGreaterThan(0);
    expect(within(card).getAllByText(block.hash).length).toBeGreaterThan(0);
    expect(within(card).getAllByText("1,204", { exact: false }).length).toBeGreaterThan(0);
    expect(within(card).getAllByText("412 kB", { exact: false }).length).toBeGreaterThan(0);
    expect(within(card).getAllByText("0.00182340", { exact: false }).length).toBeGreaterThan(0);
  });

  it("gives icon-only values a text label for screen readers", () => {
    renderCard();
    expect(screen.getAllByText("Size", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fees", { exact: false }).length).toBeGreaterThan(0);
  });

  it("tints only the newest block's marker", () => {
    const { container, rerender } = renderCard(true);
    expect(container.querySelector("[data-tinted]")).not.toBeNull();
    rerender(
      <ol>
        <BlockCard block={block} newest={false} serverNow={NOW} />
      </ol>,
    );
    expect(container.querySelector("[data-tinted]")).toBeNull();
  });
});
