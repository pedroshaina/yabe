import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopBarSearch } from "@/components/layout/TopBarSearch";

const nav = vi.hoisted(() => ({ pathname: "/block/1", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

const HINT = "Enter a block height, block hash or transaction id";

describe("TopBarSearch", () => {
  beforeEach(() => {
    nav.pathname = "/block/1";
    nav.push.mockClear();
  });

  it("isn't shown on the home page, which has the hero search", () => {
    nav.pathname = "/";
    const { container } = render(<TopBarSearch />);
    expect(container).toBeEmptyDOMElement();
  });

  it("searches a trimmed query from inner pages", async () => {
    const user = userEvent.setup();
    render(<TopBarSearch />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    expect(input).toHaveAttribute("placeholder", "Height, hash or txid");
    await user.type(input, " 325700 {Enter}");
    expect(nav.push).toHaveBeenCalledWith("/search?q=325700");
  });

  it("shows the hint for an invalid query and stays put", async () => {
    const user = userEvent.setup();
    render(<TopBarSearch />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "xyz{Enter}");
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(HINT);
    expect(input).toHaveAccessibleDescription(HINT);
  });

  it("starts empty again on the next page", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TopBarSearch />);
    await user.type(screen.getByRole("searchbox"), "xyz{Enter}");
    nav.pathname = "/block/2";
    rerender(<TopBarSearch />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
