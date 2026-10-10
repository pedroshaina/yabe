import { expect, test } from "@playwright/test";
import { compose, engineOutput, waitFor } from "../stack/compose.ts";
import { API_URL } from "../stack/urls.ts";

// The runtime interface the homelab cluster's manifests depend on (deployment contract §9.2).

const apiReady = () => waitFor("the API", async () => (await fetch(`${API_URL}/ready`)).ok);

/** A container's stdout, line by line; `tail` keeps only the last lines. */
const stdout = (container: string, tail?: number) =>
  engineOutput("logs", ...(tail === undefined ? [] : ["--tail", String(tail)]), container)
    .split("\n")
    .filter((line) => line.trim() !== "");

const exitCode = (container: string) =>
  Number(engineOutput("inspect", "--format", "{{.State.ExitCode}}", container).trim());

// Whatever happens below, leave both apps running for the next run on a kept-up stack.
test.afterAll(async () => {
  test.setTimeout(240_000); // inside a hook, this is the hook's own timeout
  compose("start", "yabe-indexer", "yabe-api");
  await apiReady();
});

test("the API answers /health and /ready", async ({ request }) => {
  expect((await request.get(`${API_URL}/health`)).status()).toBe(200);
  expect((await request.get(`${API_URL}/ready`)).status()).toBe(200);
});

test("the API and the indexer log JSON lines on stdout", () => {
  for (const container of ["yabe-e2e-api", "yabe-e2e-indexer"]) {
    // The recent lines: a kept-up stack's whole history can be megabytes of /ready requests.
    const lines = stdout(container, 2000);
    expect(lines.length, container).toBeGreaterThan(0);
    for (const line of lines) {
      const entry = JSON.parse(line) as unknown;
      expect(entry, `${container}: ${line}`).toEqual(
        expect.objectContaining({ level: expect.any(Number), time: expect.any(Number) }),
      );
    }
  }
});

test("the indexer and the API stop cleanly on SIGTERM", async () => {
  test.setTimeout(240_000);
  for (const [service, container, message] of [
    ["yabe-indexer", "yabe-e2e-indexer", "stopping after the current block"],
    ["yabe-api", "yabe-e2e-api", "shutting down"],
  ] as const) {
    // Only lines written by this stop count: earlier stops (the outage spec, earlier runs)
    // already logged the same message.
    const before = stdout(container).length;
    compose("stop", service);
    expect(exitCode(container), `${service} exit code`).toBe(0);
    const messages = stdout(container)
      .slice(before)
      .map((line) => (JSON.parse(line) as { msg?: string }).msg);
    expect(messages, `${service} shutdown log`).toContain(message);
    compose("start", service);
  }
  await apiReady();
});
