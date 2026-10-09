import { createHmac, randomBytes } from "node:crypto";

/**
 * Builds a bitcoind `-rpcauth` value: the node stores only a salted HMAC of the
 * password, so the password never appears in its config or command line.
 * Same algorithm as Bitcoin Core's share/rpcauth/rpcauth.py.
 */
export function createRpcAuth(
  user: string,
  password: string,
  salt: string = randomBytes(16).toString("hex"),
): string {
  const hmac = createHmac("sha256", salt).update(password).digest("hex");
  return `${user}:${salt}$${hmac}`;
}
