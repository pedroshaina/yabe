import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerApi } from "@/lib/api/server";
import { loadTipHeight } from "@/lib/data/tip";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: logError }) }));

function api(response: () => Response | Promise<Response>) {
  return createServerApi("http://api:8080", async () => response());
}

describe("loadTipHeight", () => {
  beforeEach(() => logError.mockClear());

  it("returns the tip's height", async () => {
    const tip = { height: 325786, hash: "0".repeat(64), time: 1 };
    expect(await loadTipHeight(api(() => Response.json({ tip })))).toBe(325786);
  });

  it("returns null for an empty index, without logging", async () => {
    expect(await loadTipHeight(api(() => Response.json({ tip: null })))).toBeNull();
    expect(logError).not.toHaveBeenCalled();
  });

  it("returns null, and logs, when the API errors or can't be reached", async () => {
    expect(await loadTipHeight(api(() => Response.json({}, { status: 503 })))).toBeNull();
    expect(
      await loadTipHeight(api(() => Promise.reject(new TypeError("fetch failed")))),
    ).toBeNull();
    expect(logError).toHaveBeenCalledTimes(2);
  });
});
