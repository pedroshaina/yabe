import { describe, expect, it } from "vitest";
import { formatInteger } from "@/lib/format";

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
