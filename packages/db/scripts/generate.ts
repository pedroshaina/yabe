import { runPrisma, startTestDatabase } from "../src/testing/database.ts";

const db = await startTestDatabase();
try {
  const { stdout } = await runPrisma(["generate", "--sql"], db.indexerUrl);
  process.stdout.write(stdout);
} finally {
  await db.stop();
}
