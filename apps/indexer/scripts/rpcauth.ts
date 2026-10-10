import { randomBytes } from "node:crypto";
import { createRpcAuth } from "../src/rpc/rpcauth.ts";

const [user = "yabe", password = randomBytes(32).toString("hex")] = process.argv.slice(2);

process.stdout.write(
  [
    "# Paste into .env. The single quotes stop Compose from expanding the `$`.",
    `BITCOIN_RPC_AUTH='${createRpcAuth(user, password)}'`,
    `INDEXER_BITCOIN_RPC_USER=${user}`,
    `INDEXER_BITCOIN_RPC_PASSWORD=${password}`,
    "",
  ].join("\n"),
);
