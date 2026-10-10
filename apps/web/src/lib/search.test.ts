import { describe, expect, it } from "vitest";
import { classifyQuery, searchHref } from "@/lib/search";

const HASH = "0000000a3f5be1d0c27e8f94a6b3d1e07c5a2f8d6e4b9c0a7f3e1d2b5c891c4e";

describe("classifyQuery", () => {
  it.each([
    ["318442", { kind: "height", value: "318442" }],
    ["  318442 ", { kind: "height", value: "318442" }],
    ["0", { kind: "height", value: "0" }],
    ["9999999999", { kind: "height", value: "9999999999" }],
    [HASH, { kind: "hash", value: HASH }],
    [` ${HASH.toUpperCase()}\n`, { kind: "hash", value: HASH.toUpperCase() }],
  ])("accepts %j", (raw, expected) => {
    expect(classifyQuery(raw)).toEqual(expected);
  });

  it.each([
    [""],
    ["   "],
    ["318442abc"],
    ["12345678901"],
    [HASH.slice(1)],
    [HASH + "0"],
    ["-1"],
    ["3e5"],
  ])("rejects %j", (raw) => {
    expect(classifyQuery(raw)).toEqual({ kind: "invalid" });
  });
});

describe("searchHref", () => {
  it("builds the search URL", () => {
    expect(searchHref("318442")).toBe("/search?q=318442");
  });
});
