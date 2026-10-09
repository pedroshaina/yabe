import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.ts";

const valid = { API_DATABASE_URL: "postgresql://yabe_api:api-secret@127.0.0.1:5432/yabe" };

describe("loadConfig", () => {
  it("applies defaults", () => {
    expect(loadConfig(valid)).toEqual({
      databaseUrl: valid.API_DATABASE_URL,
      host: "0.0.0.0",
      port: 8080,
      corsOrigins: [],
      logLevel: "info",
      queryTimeoutMs: 10_000,
    });
  });

  it("reads the query timeout", () => {
    expect(loadConfig({ ...valid, API_QUERY_TIMEOUT_MS: "2500" }).queryTimeoutMs).toBe(2_500);
  });

  it("parses a comma-separated CORS allow-list and a port", () => {
    const config = loadConfig({
      ...valid,
      API_PORT: "3000",
      API_CORS_ORIGINS: " http://localhost:5173 , https://yabe.example ",
    });
    expect(config.port).toBe(3000);
    expect(config.corsOrigins).toEqual(["http://localhost:5173", "https://yabe.example"]);
  });

  it("names invalid variables without echoing values", () => {
    const env = { API_DATABASE_URL: "nope api-secret", API_PORT: "99999" };
    let message = "";
    try {
      loadConfig(env);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      message = (error as Error).message;
    }
    expect(message).toMatch(/API_DATABASE_URL/);
    expect(message).toMatch(/API_PORT/);
    expect(message).not.toMatch(/api-secret/);
  });
});
