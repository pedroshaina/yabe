import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundView } from "@/components/notfound/NotFoundView";

const nav = vi.hoisted(() => ({ pathname: "/", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const HASH = "9b41c7e02d5f83a16e0c4b97d2a85f31c6e09b4d7a2f58e13c06b9d4a7e2f810";
const NO_MATCH = "No block or transaction matches your search.";
const INVALID = "This isn't a valid block height, block hash or transaction id.";

function at(pathname: string, search = "") {
  nav.pathname = pathname;
  nav.search = search;
}

describe("NotFoundView", () => {
  beforeEach(() => at("/"));

  it("shows the search that found nothing, the hints and the way back", () => {
    at("/search", `q=${HASH}`);
    render(<NotFoundView />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Not found");
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText(HASH).tagName).toBe("CODE");
    expect(screen.getByText(NO_MATCH)).toBeInTheDocument();
    expect(
      screen.getByText("Block heights go from 0 to the latest indexed block."),
    ).toBeInTheDocument();
    expect(screen.getByText("Signet").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "← Back to latest blocks" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("says when the query can't be a height, hash or txid", () => {
    at("/search", "q=xyz");
    render(<NotFoundView />);
    expect(screen.getByText("xyz")).toBeInTheDocument();
    expect(screen.getByText(INVALID)).toBeInTheDocument();
    expect(screen.queryByText(NO_MATCH)).toBeNull();
  });

  it("shows the id from a /block or /tx URL", () => {
    at("/block/9999999999");
    render(<NotFoundView />);
    expect(screen.getByText("9999999999")).toBeInTheDocument();
    expect(screen.getByText(NO_MATCH)).toBeInTheDocument();
  });

  it("names no height, so it needs nothing from the API", () => {
    at(`/tx/${HASH}`);
    render(<NotFoundView />);
    expect(screen.queryByRole("link", { name: /^\d/ })).toBeNull();
  });

  it("shows no query line for an unknown page", () => {
    at("/nope");
    const { container } = render(<NotFoundView />);
    expect(container.querySelector("code")).toBeNull();
    expect(screen.getByText(NO_MATCH)).toBeInTheDocument();
  });
});
