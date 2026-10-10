import { describe, expect, it } from "vitest";
import { formatInteger, formatRelativeTime, formatSbtc, formatSize, formatUtc } from "@/lib/format";

describe("formatInteger", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [318442, "318,442"],
    [1_000_000, "1,000,000"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatInteger(value)).toBe(expected);
  });
});

describe("formatSbtc", () => {
  it.each([
    [0, "0.00000000"],
    [1, "0.00000001"],
    [182_340, "0.00182340"],
    [100_000_000, "1.00000000"],
    [312_722_100, "3.12722100"],
    [2_100_000_000_000_000, "21,000,000.00000000"],
  ])("formats %d sats as %s", (sats, expected) => {
    expect(formatSbtc(sats)).toBe(expected);
  });
});

describe("formatSize", () => {
  it.each([
    [0, "0 B"],
    [342, "342 B"],
    [999, "999 B"],
    [1_000, "1 kB"],
    [412_499, "412 kB"],
    [999_999, "1000 kB"],
    [1_000_000, "1.00 MB"],
    [1_995_000, "2.00 MB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0);
  const ago = (seconds: number) => now / 1000 - seconds;

  it.each([
    [0, "just now"],
    [59, "just now"],
    [-30, "just now"],
    [60, "1 min ago"],
    [3_599, "59 min ago"],
    [3_600, "1 h ago"],
    [86_399, "23 h ago"],
    [86_400, "1 d ago"],
    [29 * 86_400, "29 d ago"],
    [30 * 86_400, "2026-09-10"],
  ])("%d seconds ago reads %s", (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), now)).toBe(expected);
  });
});

describe("formatUtc", () => {
  it("formats unix seconds as a UTC date and time", () => {
    expect(formatUtc(Date.UTC(2026, 9, 9, 11, 41, 30) / 1000)).toBe("2026-10-09 11:41 UTC");
  });
});
