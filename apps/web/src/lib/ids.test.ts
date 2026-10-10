import { describe, expect, it } from "vitest";
import { isBlockId, isTxid } from "@/lib/ids";

const HASH = "0000000c91d7a2e44f08b3c5a1e96d2f7b0c38e45a19f6d2c7b80e4a3f2e3b05";

describe("isBlockId", () => {
  it.each([["0"], ["318440"], ["000123"], ["9999999999"], [HASH], [HASH.toUpperCase()]])(
    "accepts %s",
    (id) => {
      expect(isBlockId(id)).toBe(true);
    },
  );
  it.each([[""], ["-1"], ["12345678901"], ["31844a"], [HASH.slice(1)], [HASH + "0"], ["318440 "]])(
    "rejects %j",
    (id) => {
      expect(isBlockId(id)).toBe(false);
    },
  );
});

describe("isTxid", () => {
  it("accepts 64 hex characters in either case", () => {
    expect(isTxid(HASH)).toBe(true);
    expect(isTxid(HASH.toUpperCase())).toBe(true);
  });
  it.each([["318440"], [HASH.slice(1)], [`${HASH.slice(0, 63)}g`]])("rejects %s", (id) => {
    expect(isTxid(id)).toBe(false);
  });
});
