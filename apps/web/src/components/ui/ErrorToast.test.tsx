import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorToast } from "@/components/ui/ErrorToast";

const { refresh, toastError, toastDismiss } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastDismiss: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { error: toastError, dismiss: toastDismiss } }));

describe("ErrorToast", () => {
  it("raises a persistent toast whose Retry refreshes the page", () => {
    render(
      <ErrorToast
        id="home"
        title="Can't reach the chain data right now"
        description="Try again in a moment."
      />,
    );
    expect(toastError).toHaveBeenCalledWith(
      "Can't reach the chain data right now",
      expect.objectContaining({
        id: "home",
        description: "Try again in a moment.",
        duration: Infinity,
      }),
    );
    const options = toastError.mock.calls[0]![1] as {
      action: { label: string; onClick: (event: { preventDefault: () => void }) => void };
    };
    expect(options.action.label).toBe("Retry");
    const preventDefault = vi.fn();
    options.action.onClick({ preventDefault });
    expect(refresh).toHaveBeenCalledOnce();
    // Sonner closes a toast after its action unless the click is default-prevented; the toast
    // must stay up in case the API is still down after the refresh.
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("dismisses its toast when it unmounts (the data came back)", () => {
    const { unmount } = render(<ErrorToast id="home" title="t" description="d" />);
    unmount();
    expect(toastDismiss).toHaveBeenCalledWith("home");
  });
});
