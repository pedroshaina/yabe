import { fileURLToPath } from "node:url";

/** Where the e2e stack listens on the host (compose.e2e.yaml). */
export const WEB_URL = `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? "13000"}`;
export const API_URL = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "18080"}`;

/** What e2e:seed mined, for the specs: written last, once the API serves it. */
export const SEED_FILE = fileURLToPath(new URL("../.seed.json", import.meta.url));
