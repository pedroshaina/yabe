import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionList } from "@/components/block/TransactionList";
import type { TxSummary } from "@/lib/api/types";

const notifyMocks = vi.hoisted(() => ({
  notifyRetryable: vi.fn(),
  notifyConnectionLost: vi.fn(),
  dismissConnectionLost: vi.fn(),
}));
vi.mock("@/components/ui/notify", () => notifyMocks);
const { notifyRetryable } = notifyMocks;

const HASH = "b".repeat(64);
function tx(position: number): TxSummary {
  return {
    txid: position.toString(16).padStart(64, "0"),
    position,
    isCoinbase: position === 0,
    feeSat: position === 0 ? null : 1000,
    vsize: 141,
    inputCount: 1,
    outputCount: 2,
    totalInSat: position === 0 ? null : 2000,
    totalOutSat: 1000,
  };
}
const span = (from: number, count: number) => Array.from({ length: count }, (_, i) => tx(from + i));

function stubApi(route: (url: URL) => Response | Promise<Response>) {
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
const positions = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("TransactionList", () => {
  beforeEach(() => notifyRetryable.mockClear());

  it("shows the first page and the amounts note", () => {
    stubApi(() => Response.json({}));
    render(<TransactionList blockHash={HASH} initialTransactions={span(0, 3)} initialNext={2} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByText("Amounts in sBTC")).toBeInTheDocument();
  });

  it("shows the empty state for a block with no transactions", () => {
    stubApi(() => Response.json({}));
    render(<TransactionList blockHash={HASH} initialTransactions={[]} initialNext={null} />);
    expect(screen.getByText("No transactions in this block")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more transactions" })).toBeNull();
  });

  it("loads the next page after the last position, with 3 skeleton cards meanwhile", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = stubApi(async () => {
      await gate;
      return Response.json({ transactions: span(3, 2), next: null });
    });
    const user = userEvent.setup();
    const { container } = render(
      <TransactionList blockHash={HASH} initialTransactions={span(0, 3)} initialNext={2} />,
    );
    await user.click(screen.getByRole("button", { name: "Load more transactions" }));
    expect(container.querySelectorAll("li[aria-hidden='true']")).toHaveLength(3);
    release();
    await waitFor(() => expect(positions()).toHaveLength(5));
    expect(calls.at(-1)?.pathname).toBe(`/api/v1/blocks/${HASH}/transactions`);
    expect(calls.at(-1)?.search).toBe("?limit=25&after=2");
    expect(screen.queryByRole("button", { name: "Load more transactions" })).toBeNull();
  });

  it("drops positions it already shows and sends one request for a double click", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = stubApi(async () => {
      await gate;
      return Response.json({ transactions: span(2, 3), next: 4 });
    });
    const user = userEvent.setup();
    render(<TransactionList blockHash={HASH} initialTransactions={span(0, 3)} initialNext={2} />);
    await user.dblClick(screen.getByRole("button", { name: "Load more transactions" }));
    release();
    await waitFor(() => expect(positions()).toHaveLength(5));
    expect(new Set(positions()).size).toBe(5);
    expect(calls).toHaveLength(1);
  });

  it("keeps focus on the button while and after it loads", async () => {
    stubApi(() => Response.json({ transactions: span(3, 2), next: 4 }));
    const user = userEvent.setup();
    render(<TransactionList blockHash={HASH} initialTransactions={span(0, 3)} initialNext={2} />);
    const button = screen.getByRole("button", { name: "Load more transactions" });
    button.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(positions()).toHaveLength(5));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Load more transactions" }),
    );
  });

  it("keeps the list and offers Retry when loading fails; a stale Retry can't move the cursor back", async () => {
    let mode: "fail" | "ok" = "fail";
    const calls = stubApi((url) =>
      mode === "fail"
        ? Response.json({}, { status: 503 })
        : Response.json({
            transactions: span(Number(url.searchParams.get("after")) + 1, 2),
            next: Number(url.searchParams.get("after")) + 2,
          }),
    );
    const user = userEvent.setup();
    render(<TransactionList blockHash={HASH} initialTransactions={span(0, 3)} initialNext={2} />);
    await user.click(screen.getByRole("button", { name: "Load more transactions" }));
    await waitFor(() =>
      expect(notifyRetryable).toHaveBeenCalledWith(
        "Couldn't load more transactions",
        expect.any(Function),
      ),
    );
    expect(positions()).toHaveLength(3);

    mode = "ok";
    await user.click(screen.getByRole("button", { name: "Load more transactions" }));
    await waitFor(() => expect(positions()).toHaveLength(5));

    const staleRetry = notifyRetryable.mock.calls[0]![1] as () => void;
    staleRetry();
    await waitFor(() => expect(positions()).toHaveLength(7));
    expect(calls.at(-1)?.searchParams.get("after")).toBe("4");
    expect(new Set(positions()).size).toBe(7);
  });
});
