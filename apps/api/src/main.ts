import { createPrismaClient } from "@yabe/db";
import { buildApp } from "./app.ts";
import { ConfigError, loadConfig } from "./config.ts";

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

const prisma = createPrismaClient(config.databaseUrl);
const app = await buildApp({
  prisma,
  corsOrigins: config.corsOrigins,
  logger: { level: config.logLevel },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app
      .close()
      .then(() => prisma.$disconnect())
      .finally(() => process.exit(0));
  });
}

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, "could not start");
  await prisma.$disconnect();
  process.exit(1);
}
