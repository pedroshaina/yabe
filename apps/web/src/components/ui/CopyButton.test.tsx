import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/ui/CopyButton";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

describe("CopyButton", () => {
  beforeEach(() => toastError.mockClear());
  afterEach(() => vi.useRealTimers());

  it("copies the value and confirms for 2 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn(async () => {});
    // After setup(): user-event installs its own clipboard stub.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubClipboard(writeText);
    render(<CopyButton value="abc" label="Copy block hash" />);

    await user.click(screen.getByRole("button", { name: "Copy block hash" }));
    expect(writeText).toHaveBeenCalledWith("abc");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it.each([
    ["missing", undefined],
    ["refusing", vi.fn(async () => Promise.reject(new DOMException("denied", "NotAllowedError")))],
  ])("tells the user when the clipboard is %s, and stays usable", async (_label, writeText) => {
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<CopyButton value="abc" label="Copy block hash" />);
    await user.click(screen.getByRole("button", { name: "Copy block hash" }));
    expect(toastError).toHaveBeenCalledWith("Couldn't copy to the clipboard");
    expect(screen.getByRole("button", { name: "Copy block hash" })).toBeEnabled();
  });
});
