import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "@yabe/db";
import { buildApp } from "../src/app.ts";

const OUT = fileURLToPath(new URL("../openapi.json", import.meta.url));

// Building the document never queries the database.
const prisma = createPrismaClient("postgresql://unused:unused@127.0.0.1:1/unused");
const app = await buildApp({ prisma, corsOrigins: [], logger: false });
try {
  await app.ready();
  writeFileSync(OUT, `${JSON.stringify(app.swagger(), null, 2)}\n`);
  process.stdout.write(`wrote ${OUT}\n`);
} finally {
  await app.close();
  await prisma.$disconnect();
}
