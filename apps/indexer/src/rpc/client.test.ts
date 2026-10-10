import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";
import { z } from "zod";
import { createRpcCall } from "./client.ts";
import { RpcConnectionError } from "./errors.ts";

it("a response body that breaks off becomes RpcConnectionError", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json", "content-length": "1000" });
    res.write('{"result":');
    setTimeout(() => res.destroy(), 20);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const call = createRpcCall({
      url: `http://127.0.0.1:${port}`,
      user: "u",
      password: "p",
      timeoutMs: 5_000,
    });
    await expect(call("getblockcount", [], z.number())).rejects.toBeInstanceOf(RpcConnectionError);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
