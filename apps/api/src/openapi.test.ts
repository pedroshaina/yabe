import { readFileSync } from "node:fs";
import { createPrismaClient } from "@yabe/db";
import { expect, it } from "vitest";
import { buildApp } from "./app.ts";

it("the committed openapi.json matches the routes", async () => {
  // Building the document never queries the database.
  const prisma = createPrismaClient("postgresql://unused:unused@127.0.0.1:1/unused");
  const app = await buildApp({ prisma, corsOrigins: [], logger: false });
  try {
    await app.ready();
    const committed = JSON.parse(
      readFileSync(new URL("../openapi.json", import.meta.url), "utf8"),
    ) as { paths: Record<string, unknown> };

    expect(committed).toEqual(JSON.parse(JSON.stringify(app.swagger())));
    expect(Object.keys(committed.paths).sort()).toEqual([
      "/health",
      "/ready",
      "/v1/blocks",
      "/v1/blocks/{hashOrHeight}",
      "/v1/blocks/{hash}/transactions",
      "/v1/search",
      "/v1/status",
      "/v1/transactions/{txid}",
    ]);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});
