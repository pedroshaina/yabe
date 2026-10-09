import { createPrismaClient, type PrismaClient } from "@yabe/db";
import { blockData, startTestDatabase, type TestDatabase } from "@yabe/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "./app.ts";

describe("API skeleton", () => {
  let db: TestDatabase;
  let writer: PrismaClient;
  let reader: PrismaClient;
  let app: App;

  beforeAll(async () => {
    db = await startTestDatabase();
    writer = createPrismaClient(db.indexerUrl);
    reader = createPrismaClient(db.apiUrl);
    app = await buildApp({ prisma: reader, corsOrigins: ["https://yabe.example"], logger: false });
    app.get("/boom", () => {
      throw new Error('relation "secret_table" does not exist at SELECT * FROM secret_table');
    });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await reader?.$disconnect();
    await writer?.$disconnect();
    await db?.stop();
  });

  const expectProblem = (
    response: { statusCode: number; headers: Record<string, unknown>; json(): unknown },
    status: number,
  ) => {
    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({ type: "about:blank", status });
  };

  it("GET /health is ok without touching the database", async () => {
    const response = await app.inject({ url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("GET /ready is ok when the database answers", async () => {
    const response = await app.inject({ url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("GET /ready is a 503 problem when the database is unreachable", async () => {
    const down = createPrismaClient("postgresql://yabe_api:x@127.0.0.1:1/yabe", {
      connectionTimeoutMs: 500,
    });
    const offline = await buildApp({ prisma: down, corsOrigins: [], logger: false });
    try {
      const response = await offline.inject({ url: "/ready" });
      expectProblem(response, 503);
      expect(response.json()).toMatchObject({ title: "Service Unavailable" });
    } finally {
      await offline.close();
      await down.$disconnect();
    }
  });

  it("GET /v1/status reports no tip on an empty database, then the tip", async () => {
    expect((await app.inject({ url: "/v1/status" })).json()).toEqual({ tip: null });

    await writer.block.create({ data: blockData(0) });

    expect((await app.inject({ url: "/v1/status" })).json()).toEqual({
      tip: { height: 0, hash: blockData(0).hash, time: Number(blockData(0).time) },
    });
  });

  it("an unknown route is a 404 problem", async () => {
    expectProblem(await app.inject({ url: "/v1/nope" }), 404);
  });

  it("an unexpected error is a 500 problem without internals", async () => {
    const response = await app.inject({ url: "/boom" });
    expectProblem(response, 500);
    expect(response.body).not.toMatch(/secret_table|SELECT|at /);
  });

  it("serves the OpenAPI document and the docs UI", async () => {
    const spec = await app.inject({ url: "/openapi.json" });
    expect(spec.statusCode).toBe(200);
    const document = spec.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths)).toContain("/v1/status");
    expect((await app.inject({ url: "/docs" })).statusCode).toBeLessThan(400);
  });

  it("sets security headers and only allows listed CORS origins", async () => {
    const allowed = await app.inject({
      url: "/health",
      headers: { origin: "https://yabe.example" },
    });
    expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://yabe.example");

    const other = await app.inject({ url: "/health", headers: { origin: "https://evil.example" } });
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
