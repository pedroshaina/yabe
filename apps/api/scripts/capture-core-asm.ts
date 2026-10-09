import { createHmac, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GenericContainer, Wait } from "testcontainers";

const OUT = fileURLToPath(new URL("../src/script/__fixtures__/core-asm.json", import.meta.url));

const bytes = (n: number, byte = "ab") => byte.repeat(n);
const le16 = (n: number) => Buffer.from([n & 0xff, n >> 8]).toString("hex");
const varint = (n: number) => (n < 0xfd ? n.toString(16).padStart(2, "0") : `fd${le16(n)}`);
/** A strictly DER-encoded 71-byte signature (r and s 32 bytes each) plus a sighash byte. */
const der = (hashType: number, rFirstByte = "11") =>
  `30440220${rFirstByte}${bytes(31, "22")}0220${bytes(32, "33")}${hashType.toString(16).padStart(2, "0")}`;
const push = (hex: string) => {
  const n = hex.length / 2;
  if (n < 0x4c) return n.toString(16).padStart(2, "0") + hex;
  if (n <= 0xff) return `4c${n.toString(16).padStart(2, "0")}${hex}`;
  return `4d${le16(n)}${hex}`;
};
const pubkey = `02${bytes(32, "11")}`;
const everyOpcode = Array.from({ length: 0x100 - 0x4f }, (_, i) => (0x4f + i).toString(16)).join(
  "",
);

const scriptPubKeys: Record<string, string> = {
  empty: "",
  p2pkh: `76a914${bytes(20, "11")}88ac`,
  p2sh: `a914${bytes(20)}87`,
  p2wpkh: `0014${bytes(20)}`,
  p2wsh: `0020${bytes(32)}`,
  p2tr: `5120${bytes(32)}`,
  "p2pk compressed": `21${pubkey}ac`,
  "p2pk uncompressed": `41${"04"}${bytes(64, "22")}ac`,
  "bare multisig 1-of-2": `5121${pubkey}21${"03"}${bytes(32, "44")}52ae`,
  nulldata: `6a0b${bytes(11)}`,
  "op_return alone": "6a",
  "op_return small push": "6a04deadbeef",
  op_0: "00",
  "small pushes as numbers": "01010181018002ff0002008004ffffffff030102030400000080",
  "pushdata variants": `4c05${bytes(5)}4d0500${bytes(5)}4e05000000${bytes(5)}4c02abcd`,
  "truncated push": "050102",
  "truncated after opcode": "760501",
  "truncated pushdata1": "4c",
  "truncated pushdata2": "4d01",
  "truncated pushdata4": "4e010000",
  "every opcode from 0x4f": everyOpcode,
  "signature in a scriptPubKey is not decoded": push(der(0x01)),
};

const scriptSigs: Record<string, string> = {
  empty: "",
  "p2pkh spend": push(der(0x01)) + push(pubkey),
  "sighash types": [0x02, 0x03, 0x81, 0x82, 0x83].map((t) => push(der(t))).join(""),
  "undefined sighash types": [0x00, 0x04, 0x84].map((t) => push(der(t))).join(""),
  "bad der header": push(`31${der(0x01).slice(2)}`),
  "negative r is not der": push(der(0x01, "91")),
  "multisig spend": `00${push(der(0x01))}${push(der(0x01, "12"))}`,
  "p2sh-p2wpkh redeem script": push(`0014${bytes(20)}`),
  "op_return first disables decoding": `6a${push(der(0x01))}`,
  "over 10000 bytes disables decoding": push(der(0x01)) + push(bytes(10_000)),
  "small pushes": "000101",
  "truncated signature": `47${der(0x01).slice(0, 20)}`,
};

async function main() {
  const password = randomBytes(16).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const hmac = createHmac("sha256", salt).update(password).digest("hex");
  const container = await new GenericContainer("bitcoin/bitcoin:31.1")
    .withCommand([
      "-regtest",
      "-server",
      "-rpcbind=0.0.0.0",
      "-rpcallowip=0.0.0.0/0",
      `-rpcauth=capture:${salt}$${hmac}`,
    ])
    .withExposedPorts(18443)
    .withWaitStrategy(Wait.forLogMessage(/init message: Done loading/))
    .start();
  const url = `http://${container.getHost()}:${container.getMappedPort(18443)}`;
  const call = async (method: string, params: unknown[]): Promise<Record<string, unknown>> => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`capture:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({ jsonrpc: "1.0", id: method, method, params }),
    });
    const body = (await response.json()) as { result: Record<string, unknown>; error: unknown };
    if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
    return body.result;
  };

  try {
    const fixtures: {
      kind: "scriptPubKey" | "scriptSig";
      name: string;
      hex: string;
      asm: string;
    }[] = [];
    for (const [name, hex] of Object.entries(scriptPubKeys)) {
      const decoded = await call("decodescript", [hex]);
      fixtures.push({ kind: "scriptPubKey", name, hex, asm: decoded.asm as string });
    }
    for (const [name, hex] of Object.entries(scriptSigs)) {
      // version | 1 input (null-ish prevout, vout 0, scriptSig) | 1 empty output | locktime
      const tx = `02000000010${"0".repeat(63)}00000000${varint(hex.length / 2)}${hex}ffffffff01${"00".repeat(8)}0000000000`;
      const decoded = await call("decoderawtransaction", [tx]);
      const vin = (decoded.vin as { scriptSig: { asm: string } }[])[0]!;
      fixtures.push({ kind: "scriptSig", name, hex, asm: vin.scriptSig.asm });
    }
    writeFileSync(OUT, `${JSON.stringify(fixtures, null, 2)}\n`);
    process.stdout.write(
      `captured ${fixtures.length} scripts from Bitcoin Core 31.1 into ${OUT}\n`,
    );
  } finally {
    await container.stop();
  }
}

await main();
