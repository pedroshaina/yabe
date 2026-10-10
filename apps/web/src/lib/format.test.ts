import { describe, expect, it } from "vitest";
import {
  formatDifficulty,
  formatFeeRate,
  formatInteger,
  formatRelativeTime,
  formatSbtc,
  formatSbtcOrDash,
  formatSize,
  formatUtc,
  formatVersion,
  formatWeight,
  middleEllipsis,
  plural,
  shortHash,
} from "@/lib/format";

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

describe("shortHash", () => {
  it("keeps the first and last 4 characters", () => {
    expect(shortHash("a91c0000000000000000000000000000000000000000000000000000000004e2")).toBe(
      "a91c…04e2",
    );
  });
  it("leaves short strings alone", () => {
    expect(shortHash("abcdefgh")).toBe("abcdefgh");
  });
});

describe("formatWeight", () => {
  it.each([
    [0, "0.00 MWU"],
    [1_260, "0.00 MWU"],
    [1_640_000, "1.64 MWU"],
    [4_000_000, "4.00 MWU"],
  ])("formats %d WU as %s", (weight, expected) => {
    expect(formatWeight(weight)).toBe(expected);
  });
});

describe("formatFeeRate", () => {
  it.each([
    [10, "10.0 sat/vB"],
    [1.04, "1.0 sat/vB"],
    [228.0434782608, "228.0 sat/vB"],
    [null, "—"],
  ])("formats %s", (rate, expected) => {
    expect(formatFeeRate(rate)).toBe(expected);
  });
});

describe("formatDifficulty", () => {
  it.each([
    [0.002616046, "0.002616"],
    [1, "1"],
    [123.456789, "123.5"],
    [1_234_567.89, "1,234,568"],
    [83_148_355_189_239.77, "83,148,355,189,240"],
  ])("formats %d as %s", (difficulty, expected) => {
    expect(formatDifficulty(difficulty)).toBe(expected);
  });
});

describe("formatVersion", () => {
  it.each([
    [0x20000000, "0x20000000"],
    [1, "0x00000001"],
    [0x3fff0000, "0x3fff0000"],
  ])("formats %d as %s", (version, expected) => {
    expect(formatVersion(version)).toBe(expected);
  });
});

describe("plural", () => {
  it.each([
    [0, "input", undefined, "0 inputs"],
    [1, "input", undefined, "1 input"],
    [1204, "input", undefined, "1,204 inputs"],
    [1, "confirmation", undefined, "1 confirmation"],
    [3, "confirmation", undefined, "3 confirmations"],
  ])("plural(%d, %s)", (count, singular, pluralForm, expected) => {
    expect(plural(count, singular, pluralForm)).toBe(expected);
  });
});

describe("formatSbtcOrDash", () => {
  it("formats sats or shows a dash", () => {
    expect(formatSbtcOrDash(1410)).toBe("0.00001410");
    expect(formatSbtcOrDash(0)).toBe("0.00000000");
    expect(formatSbtcOrDash(null)).toBe("—");
  });
});

describe("middleEllipsis", () => {
  it.each([
    ["tb1pzczwmt4kenu8j0avnhpyefp3gph32w2syuym8p8qxs5ulxudus3sqmsj75", "tb1pzczwmt…qmsj75"],
    ["tb1qxc9rhgpdjcp42nmhg6lepe7pp5g86tx25vlv8h", "tb1qxc9rhg…5vlv8h"],
    ["12345678901234567", "12345678901234567"],
    ["123456789012345678", "1234567890…345678"],
    ["tb1qinputone", "tb1qinputone"],
  ])("%s → %s", (value, expected) => {
    expect(middleEllipsis(value)).toBe(expected);
  });
});
