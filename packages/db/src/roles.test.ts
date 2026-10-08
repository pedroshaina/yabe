import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "./testing/database.ts";

async function query(url: string, sql: string): Promise<pg.QueryResult> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

describe("database roles", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase({ migrate: false });
  });

  afterAll(async () => {
    await db?.stop();
  });

  it("lets yabe_indexer create tables", async () => {
    await query(db.indexerUrl, "CREATE TABLE indexer_owned (id int PRIMARY KEY)");
    await query(db.indexerUrl, "INSERT INTO indexer_owned VALUES (1)");
  });

  it("lets yabe_api read tables created by yabe_indexer", async () => {
    const result = await query(db.apiUrl, "SELECT id FROM indexer_owned");
    expect(result.rows).toEqual([{ id: 1 }]);
  });

  it("does not let yabe_api write", async () => {
    await expect(query(db.apiUrl, "INSERT INTO indexer_owned VALUES (2)")).rejects.toThrow(
      /permission denied/,
    );
    await expect(query(db.apiUrl, "DELETE FROM indexer_owned")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("does not let yabe_api create tables", async () => {
    await expect(query(db.apiUrl, "CREATE TABLE api_owned (id int)")).rejects.toThrow(
      /permission denied/,
    );
  });
});
