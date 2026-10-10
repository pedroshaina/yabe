import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scriptToAsm } from "./asm.ts";

interface Fixture {
  kind: "scriptPubKey" | "scriptSig";
  name: string;
  hex: string;
  asm: string;
}

/** Captured from Bitcoin Core 31.1 by scripts/capture-core-asm.ts; Core is the reference. */
const fixtures = JSON.parse(
  readFileSync(new URL("./__fixtures__/core-asm.json", import.meta.url), "utf8"),
) as Fixture[];

describe("scriptToAsm matches Bitcoin Core", () => {
  it("has a reference set covering both script kinds and every opcode", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(30);
    expect(fixtures.some((f) => f.name === "every opcode from 0x4f")).toBe(true);
    expect(fixtures.some((f) => f.kind === "scriptSig")).toBe(true);
  });

  it.each(fixtures)("$kind: $name", ({ kind, hex, asm }) => {
    expect(scriptToAsm(hex, { attemptSighashDecode: kind === "scriptSig" })).toBe(asm);
  });
});
