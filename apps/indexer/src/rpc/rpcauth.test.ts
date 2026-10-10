import { expect, it } from "vitest";
import { createRpcAuth } from "./rpcauth.ts";

it("matches Bitcoin Core's rpcauth test vector", () => {
  expect(
    createRpcAuth(
      "rt",
      "cA773lm788buwYe4g4WT+05pKyNruVKjQ25x3n0DQcM=",
      "93648e835a54c573682c2eb19f882535",
    ),
  ).toBe(
    "rt:93648e835a54c573682c2eb19f882535$7681e9c5b74bdd85e78166031d2058e1069b3ed7ed967c93fc63abba06f31144",
  );
});

it("uses a fresh random salt by default", () => {
  expect(createRpcAuth("u", "p")).not.toBe(createRpcAuth("u", "p"));
  expect(createRpcAuth("u", "p")).toMatch(/^u:[0-9a-f]{32}\$[0-9a-f]{64}$/);
});
