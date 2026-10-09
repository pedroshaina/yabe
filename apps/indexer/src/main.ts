import { createPrismaClient } from "@yabe/db";
import { pino } from "pino";
import { ConfigError, loadConfig } from "./config.ts";
import { createBitcoinNode } from "./rpc/node.ts";
import { checkNode } from "./sync/startup.ts";
import { runSync } from "./sync/sync.ts";

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

const logger = pino({ level: config.logLevel });
const prisma = createPrismaClient(config.databaseUrl);
const node = createBitcoinNode(config.rpc);

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "stopping after the current block");
    controller.abort();
  });
}

try {
  logger.info({ network: config.network, rpc: config.rpc.url }, "starting indexer");
  await checkNode(node, prisma, config.network);
  await runSync(
    { node, prisma, network: config.network, logger, pollIntervalMs: config.pollIntervalMs },
    controller.signal,
  );
  logger.info("stopped");
} catch (error) {
  logger.fatal({ err: error }, "indexer stopped on an error");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
