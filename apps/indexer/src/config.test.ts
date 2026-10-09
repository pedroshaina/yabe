import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.ts";

const valid = {
  DATABASE_URL: "postgresql://yabe_indexer:db-secret@127.0.0.1:5432/yabe",
  BITCOIN_NETWORK: "signet",
  BITCOIN_RPC_URL: "http://127.0.0.1:38332",
  BITCOIN_RPC_USER: "yabe",
  BITCOIN_RPC_PASSWORD: "rpc-secret",
};

describe("loadConfig", () => {
  it("parses a valid environment and applies defaults", () => {
    expect(loadConfig(valid)).toEqual({
      databaseUrl: valid.DATABASE_URL,
      network: "signet",
      rpc: { url: valid.BITCOIN_RPC_URL, user: "yabe", password: "rpc-secret", timeoutMs: 30_000 },
      pollIntervalMs: 5_000,
      logLevel: "info",
    });
  });

  it("coerces numeric settings", () => {
    const config = loadConfig({
      ...valid,
      POLL_INTERVAL_MS: "250",
      BITCOIN_RPC_TIMEOUT_MS: "1000",
    });
    expect(config.pollIntervalMs).toBe(250);
    expect(config.rpc.timeoutMs).toBe(1_000);
  });

  it("names every missing or invalid variable", () => {
    const { BITCOIN_RPC_PASSWORD: _omit, ...missingPassword } = valid;
    const env = { ...missingPassword, BITCOIN_NETWORK: "moonnet" };

    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/BITCOIN_RPC_PASSWORD/);
    expect(() => loadConfig(env)).toThrow(/BITCOIN_NETWORK/);
  });

  it("rejects credentials embedded in BITCOIN_RPC_URL, without echoing them", () => {
    // The URL is logged at startup; credentials belong in BITCOIN_RPC_USER/PASSWORD.
    const env = { ...valid, BITCOIN_RPC_URL: "http://yabe:url-secret@127.0.0.1:38332" };

    expect(() => loadConfig(env)).toThrow(/BITCOIN_RPC_URL/);
    expect(() => loadConfig(env)).not.toThrow(/url-secret/);
  });

  it("never echoes secret values in errors", () => {
    const env = { ...valid, POLL_INTERVAL_MS: "soon", DATABASE_URL: "not a url db-secret" };

    let message = "";
    try {
      loadConfig(env);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/POLL_INTERVAL_MS/);
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toMatch(/rpc-secret|db-secret/);
  });
});
