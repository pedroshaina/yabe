import { cli, compose, waitFor } from "./compose.ts";
import { API_URL, WEB_URL } from "./urls.ts";

// Builds every image and starts the regtest stack (Compose project yabe-e2e).
compose("up", "-d", "--build");
await waitFor("bitcoind", () => cli("getblockchaininfo").length > 0);
await waitFor("the API", async () => (await fetch(`${API_URL}/ready`)).ok);
await waitFor("the web app", async () => (await fetch(`${WEB_URL}/api/health`)).ok);
console.log(`e2e stack up: web ${WEB_URL}, API ${API_URL}`);
