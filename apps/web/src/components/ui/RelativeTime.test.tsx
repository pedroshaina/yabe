import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelativeTime } from "@/components/ui/RelativeTime";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

describe("RelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the relative time with the exact UTC time as a tooltip", () => {
    render(<RelativeTime time={NOW / 1000 - 90} serverNow={NOW} />);
    const time = screen.getByText("1 min ago");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-10-10T11:58:30.000Z");
    expect(time).toHaveAttribute("title", "2026-10-10 11:58 UTC");
  });

  it("updates as time passes", () => {
    render(<RelativeTime time={NOW / 1000 - 90} serverNow={NOW} />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("2 min ago")).toBeInTheDocument();
  });
});
