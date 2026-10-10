import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockTimeline } from "@/components/home/BlockTimeline";
import type { BlockSummary } from "@/lib/api/types";

const notifyMocks = vi.hoisted(() => ({
  notifyRetryable: vi.fn(),
  notifyConnectionLost: vi.fn(),
  dismissConnectionLost: vi.fn(),
}));
vi.mock("@/components/ui/notify", () => notifyMocks);
const { notifyRetryable } = notifyMocks;

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
function block(height: number): BlockSummary {
  return {
    height,
    hash: height.toString(16).padStart(64, "0"),
    time: NOW / 1000 - (318442 - height) * 600,
    txCount: 10,
    size: 1000,
    weight: 4000,
    totalFeeSat: 100,
  };
}
const range = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => block(from - i));

type Route = (url: URL) => Response | Promise<Response>;
function stubApi(route: Route) {
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      calls.push(url);
      return route(url);
    }),
  );
  return calls;
}
const blockCalls = (calls: URL[]) => calls.filter((u) => u.pathname === "/api/v1/blocks");
const heights = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("BlockTimeline", () => {
  beforeEach(() => notifyRetryable.mockClear());

  it("shows the first page, newest first, newest marker tinted", () => {
    stubApi(() => Response.json({ tip: null }));
    const { container } = render(
      <BlockTimeline initialBlocks={range(318442, 3)} initialNext={318440} serverNow={NOW} />,
    );
    expect(heights()).toEqual(["/block/318442", "/block/318441", "/block/318440"]);
    expect(container.querySelectorAll("[data-tinted]")).toHaveLength(1);
  });

  it("shows the empty state when nothing is indexed", () => {
    stubApi(() => Response.json({ tip: null }));
    render(<BlockTimeline initialBlocks={[]} initialNext={null} serverNow={NOW} />);
    expect(screen.getByText("No blocks indexed yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load older blocks" })).toBeNull();
  });

  it("loads the next page with the cursor, showing 3 skeleton cards meanwhile", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const calls = stubApi(async (url) => {
      if (url.pathname === "/api/v1/status") return Response.json({ tip: null });
      await gate;
      return Response.json({ blocks: range(318439, 2), next: 318438 });
    });
    const user = userEvent.setup();
    const { container } = render(
      <BlockTimeline initialBlocks={range(318442, 3)} initialNext={318440} serverNow={NOW} />,
    );

    await user.click(screen.getByRole("button", { name: "Load older blocks" }));
    expect(container.querySelectorAll("li[aria-hidden='true']")).toHaveLength(3);
    release();

    await waitFor(() => expect(heights()).toHaveLength(5));
    expect(heights().at(-1)).toBe("/block/318438");
    expect(container.querySelectorAll("li[aria-hidden='true']")).toHaveLength(0);
    expect(blockCalls(calls).map((u) => u.search)).toEqual(["?limit=10&before=318440"]);
  });

  it("drops blocks it already shows", async () => {
    stubApi((url) =>
      url.pathname === "/api/v1/status"
        ? Response.json({ tip: null })
        : Response.json({ blocks: range(318440, 3), next: 318437 }),
    );
    const user = userEvent.setup();
    render(<BlockTimeline initialBlocks={range(318442, 3)} initialNext={318440} serverNow={NOW} />);
    await user.click(screen.getByRole("button", { name: "Load older blocks" }));
    await waitFor(() => expect(heights()).toHaveLength(5));
    expect(new Set(heights()).size).toBe(5);
  });

  it("sends one request when clicked twice quickly", async () => {
    const calls = stubApi((url) =>
      url.pathname === "/api/v1/status"
        ? Response.json({ tip: null })
        : Response.json({ blocks: range(318439, 2), next: 318438 }),
    );
    const user = userEvent.setup();
    render(<BlockTimeline initialBlocks={range(318442, 3)} initialNext={318440} serverNow={NOW} />);
    const button = screen.getByRole("button", { name: "Load older blocks" });
    await user.dblClick(button);
    await waitFor(() => expect(heights()).toHaveLength(5));
    expect(blockCalls(calls)).toHaveLength(1);
  });

  it("hides the button when there are no older blocks", async () => {
    stubApi((url) =>
      url.pathname === "/api/v1/status"
        ? Response.json({ tip: null })
        : Response.json({ blocks: range(1, 2), next: null }),
    );
    const user = userEvent.setup();
    render(<BlockTimeline initialBlocks={range(3, 2)} initialNext={2} serverNow={NOW} />);
    await user.click(screen.getByRole("button", { name: "Load older blocks" }));
    await waitFor(() => expect(heights()).toHaveLength(4));
    expect(screen.queryByRole("button", { name: "Load older blocks" })).toBeNull();
  });

  it("keeps what it shows and offers Retry when loading fails", async () => {
    let fail = true;
    stubApi((url) => {
      if (url.pathname === "/api/v1/status") return Response.json({ tip: null });
      return fail
        ? Response.json({ status: 503 }, { status: 503 })
        : Response.json({ blocks: range(318439, 2), next: 318438 });
    });
    const user = userEvent.setup();
    const { container } = render(
      <BlockTimeline initialBlocks={range(318442, 3)} initialNext={318440} serverNow={NOW} />,
    );
    await user.click(screen.getByRole("button", { name: "Load older blocks" }));

    await waitFor(() => expect(notifyRetryable).toHaveBeenCalledOnce());
    expect(notifyRetryable.mock.calls[0]![0]).toBe("Couldn't load more blocks");
    expect(heights()).toHaveLength(3);
    expect(container.querySelectorAll("li[aria-hidden='true']")).toHaveLength(0);

    fail = false;
    const retry = notifyRetryable.mock.calls[0]![1] as () => void;
    retry();
    await waitFor(() => expect(heights()).toHaveLength(5));
  });

  it("labels the list for assistive technology", () => {
    stubApi(() => Response.json({ tip: null }));
    render(<BlockTimeline initialBlocks={range(318442, 1)} initialNext={null} serverNow={NOW} />);
    expect(
      within(screen.getByRole("list", { name: "Latest blocks" })).getAllByRole("link"),
    ).toHaveLength(1);
  });
});
