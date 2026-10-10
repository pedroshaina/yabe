import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "@/config";

describe("loadConfig", () => {
  it("reads the API origin and defaults the log level", () => {
    expect(loadConfig({ WEB_API_URL: "http://yabe-api:8080" })).toEqual({
      apiUrl: "http://yabe-api:8080",
      logLevel: "info",
    });
  });

  it("accepts and drops a trailing slash", () => {
    expect(loadConfig({ WEB_API_URL: "http://127.0.0.1:8080/" }).apiUrl).toBe(
      "http://127.0.0.1:8080",
    );
  });

  it("reads LOG_LEVEL", () => {
    expect(loadConfig({ WEB_API_URL: "http://a:1", LOG_LEVEL: "debug" }).logLevel).toBe("debug");
  });

  it.each([
    ["missing", {}],
    ["not a URL", { WEB_API_URL: "not-a-url" }],
    ["without a scheme", { WEB_API_URL: "yabe-api:8080" }],
    ["not http(s)", { WEB_API_URL: "ftp://yabe-api:8080" }],
    ["with a path", { WEB_API_URL: "http://yabe-api:8080/v1" }],
    ["with a query", { WEB_API_URL: "http://yabe-api:8080/?x=1" }],
  ])("rejects WEB_API_URL %s, naming the variable", (_label, env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/WEB_API_URL/);
  });

  it("rejects an unknown LOG_LEVEL", () => {
    expect(() => loadConfig({ WEB_API_URL: "http://a:1", LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
