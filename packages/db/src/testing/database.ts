import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const execFileAsync = promisify(execFile);

// Works from both src/testing and dist/testing: two levels up is packages/db.
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const rolesScript = fileURLToPath(new URL("../../initdb/01-roles.sh", import.meta.url));

const POSTGRES_IMAGE = "postgres:18-alpine";
const INDEXER_PASSWORD = "indexer-test-password";
const API_PASSWORD = "api-test-password";

export interface TestDatabase {
  superuserUrl: string;
  indexerUrl: string;
  apiUrl: string;
  stop(): Promise<void>;
}

/** Runs the Prisma CLI in packages/db against the given database. */
export async function runPrisma(
  args: string[],
  databaseUrl: string,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("pnpm", ["exec", "prisma", ...args], {
    cwd: packageRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

/**
 * Starts a throwaway Postgres configured like production: the same roles init
 * script, and (unless `migrate: false`) all migrations applied as yabe_indexer.
 * Callers must call `stop()`; on Podman, Ryuk is disabled and nothing else will.
 */
export async function startTestDatabase(
  options: { migrate?: boolean } = {},
): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase("yabe")
    .withEnvironment({
      YABE_INDEXER_PASSWORD: INDEXER_PASSWORD,
      YABE_API_PASSWORD: API_PASSWORD,
    })
    .withCopyFilesToContainer([
      { source: rolesScript, target: "/docker-entrypoint-initdb.d/01-roles.sh", mode: 0o755 },
    ])
    .start();

  const superuserUrl = container.getConnectionUri();
  const urlFor = (user: string, password: string): string => {
    const url = new URL(superuserUrl);
    url.username = user;
    url.password = password;
    return url.toString();
  };

  const db: TestDatabase = {
    superuserUrl,
    indexerUrl: urlFor("yabe_indexer", INDEXER_PASSWORD),
    apiUrl: urlFor("yabe_api", API_PASSWORD),
    stop: async () => {
      await container.stop();
    },
  };

  if (options.migrate ?? true) {
    try {
      await runPrisma(["migrate", "deploy"], db.indexerUrl);
    } catch (error) {
      await db.stop();
      throw error;
    }
  }

  return db;
}
