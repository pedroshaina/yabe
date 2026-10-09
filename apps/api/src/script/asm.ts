/**
 * Script → asm, ported from Bitcoin Core 31.1 (core_io.cpp ScriptToAsmStr,
 * script.cpp GetOpName/GetScriptOp, interpreter.cpp signature checks) so the
 * API shows exactly what the node shows. asm.test.ts compares against asm
 * captured from Core itself.
 */

const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const OP_PUSHDATA4 = 0x4e;
const OP_RETURN = 0x6a;
const MAX_SCRIPT_SIZE = 10_000;

/** Names for 0x61 (OP_NOP) to 0xba (OP_CHECKSIGADD), in opcode order. */
const NAMED_FROM_0X61 = [
  "OP_NOP",
  "OP_VER",
  "OP_IF",
  "OP_NOTIF",
  "OP_VERIF",
  "OP_VERNOTIF",
  "OP_ELSE",
  "OP_ENDIF",
  "OP_VERIFY",
  "OP_RETURN",
  "OP_TOALTSTACK",
  "OP_FROMALTSTACK",
  "OP_2DROP",
  "OP_2DUP",
  "OP_3DUP",
  "OP_2OVER",
  "OP_2ROT",
  "OP_2SWAP",
  "OP_IFDUP",
  "OP_DEPTH",
  "OP_DROP",
  "OP_DUP",
  "OP_NIP",
  "OP_OVER",
  "OP_PICK",
  "OP_ROLL",
  "OP_ROT",
  "OP_SWAP",
  "OP_TUCK",
  "OP_CAT",
  "OP_SUBSTR",
  "OP_LEFT",
  "OP_RIGHT",
  "OP_SIZE",
  "OP_INVERT",
  "OP_AND",
  "OP_OR",
  "OP_XOR",
  "OP_EQUAL",
  "OP_EQUALVERIFY",
  "OP_RESERVED1",
  "OP_RESERVED2",
  "OP_1ADD",
  "OP_1SUB",
  "OP_2MUL",
  "OP_2DIV",
  "OP_NEGATE",
  "OP_ABS",
  "OP_NOT",
  "OP_0NOTEQUAL",
  "OP_ADD",
  "OP_SUB",
  "OP_MUL",
  "OP_DIV",
  "OP_MOD",
  "OP_LSHIFT",
  "OP_RSHIFT",
  "OP_BOOLAND",
  "OP_BOOLOR",
  "OP_NUMEQUAL",
  "OP_NUMEQUALVERIFY",
  "OP_NUMNOTEQUAL",
  "OP_LESSTHAN",
  "OP_GREATERTHAN",
  "OP_LESSTHANOREQUAL",
  "OP_GREATERTHANOREQUAL",
  "OP_MIN",
  "OP_MAX",
  "OP_WITHIN",
  "OP_RIPEMD160",
  "OP_SHA1",
  "OP_SHA256",
  "OP_HASH160",
  "OP_HASH256",
  "OP_CODESEPARATOR",
  "OP_CHECKSIG",
  "OP_CHECKSIGVERIFY",
  "OP_CHECKMULTISIG",
  "OP_CHECKMULTISIGVERIFY",
  "OP_NOP1",
  "OP_CHECKLOCKTIMEVERIFY",
  "OP_CHECKSEQUENCEVERIFY",
  "OP_NOP4",
  "OP_NOP5",
  "OP_NOP6",
  "OP_NOP7",
  "OP_NOP8",
  "OP_NOP9",
  "OP_NOP10",
  "OP_CHECKSIGADD",
];

function opName(opcode: number): string {
  if (opcode === 0x00) return "0";
  if (opcode === OP_PUSHDATA1) return "OP_PUSHDATA1";
  if (opcode === OP_PUSHDATA2) return "OP_PUSHDATA2";
  if (opcode === OP_PUSHDATA4) return "OP_PUSHDATA4";
  if (opcode === 0x4f) return "-1";
  if (opcode === 0x50) return "OP_RESERVED";
  if (opcode >= 0x51 && opcode <= 0x60) return String(opcode - 0x50);
  if (opcode >= 0x61 && opcode <= 0xba) return NAMED_FROM_0X61[opcode - 0x61]!;
  if (opcode === 0xff) return "OP_INVALIDOPCODE";
  return "OP_UNKNOWN";
}

const SIGHASH_NAMES: Record<number, string> = {
  0x01: "ALL",
  0x81: "ALL|ANYONECANPAY",
  0x02: "NONE",
  0x82: "NONE|ANYONECANPAY",
  0x03: "SINGLE",
  0x83: "SINGLE|ANYONECANPAY",
};

/** CScriptNum decoding (little-endian, sign in the top bit of the last byte); pushes ≤ 4 bytes. */
function scriptNum(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let value = 0;
  for (let i = 0; i < data.length; i += 1) {
    value += data[i]! * 2 ** (8 * i);
  }
  const last = data[data.length - 1]!;
  if (last & 0x80) {
    return -(value - 0x80 * 2 ** (8 * (data.length - 1)));
  }
  return value;
}

/** BIP66 strict DER (interpreter.cpp IsValidSignatureEncoding), including the sighash byte. */
function isValidSignatureEncoding(sig: Uint8Array): boolean {
  if (sig.length < 9 || sig.length > 73) return false;
  if (sig[0] !== 0x30) return false;
  if (sig[1] !== sig.length - 3) return false;
  const lenR = sig[3]!;
  if (5 + lenR >= sig.length) return false;
  const lenS = sig[5 + lenR]!;
  if (lenR + lenS + 7 !== sig.length) return false;
  if (sig[2] !== 0x02) return false;
  if (lenR === 0) return false;
  if (sig[4]! & 0x80) return false;
  if (lenR > 1 && sig[4] === 0x00 && !(sig[5]! & 0x80)) return false;
  if (sig[lenR + 4] !== 0x02) return false;
  if (lenS === 0) return false;
  if (sig[lenR + 6]! & 0x80) return false;
  if (lenS > 1 && sig[lenR + 6] === 0x00 && !(sig[lenR + 7]! & 0x80)) return false;
  return true;
}

/** CheckSignatureEncoding with SCRIPT_VERIFY_STRICTENC: valid DER and a defined sighash type. */
function isStrictSignature(sig: Uint8Array): boolean {
  if (!isValidSignatureEncoding(sig)) return false;
  const hashType = sig[sig.length - 1]! & ~0x80;
  return hashType >= 0x01 && hashType <= 0x03;
}

const toHex = (data: Uint8Array) => Buffer.from(data).toString("hex");

/**
 * Bitcoin Core's asm for a script. `attemptSighashDecode` is Core's flag for
 * scriptSigs: it shows a signature's sighash byte as e.g. `[ALL]`.
 */
export function scriptToAsm(hex: string, options: { attemptSighashDecode?: boolean } = {}): string {
  const script = Buffer.from(hex, "hex");
  const unspendable =
    (script.length > 0 && script[0] === OP_RETURN) || script.length > MAX_SCRIPT_SIZE;
  const parts: string[] = [];
  let pc = 0;

  while (pc < script.length) {
    const opcode = script[pc]!;
    pc += 1;
    if (opcode > OP_PUSHDATA4) {
      parts.push(opName(opcode));
      continue;
    }

    let size: number;
    if (opcode < OP_PUSHDATA1) {
      size = opcode;
    } else {
      const width = opcode === OP_PUSHDATA1 ? 1 : opcode === OP_PUSHDATA2 ? 2 : 4;
      if (script.length - pc < width) {
        parts.push("[error]");
        break;
      }
      size = script.readUIntLE(pc, width);
      pc += width;
    }
    if (script.length - pc < size) {
      parts.push("[error]");
      break;
    }
    const data = script.subarray(pc, pc + size);
    pc += size;

    if (size <= 4) {
      parts.push(String(scriptNum(data)));
    } else if (options.attemptSighashDecode && !unspendable && isStrictSignature(data)) {
      const name = SIGHASH_NAMES[data[data.length - 1]!];
      parts.push(name ? `${toHex(data.subarray(0, -1))}[${name}]` : toHex(data));
    } else {
      parts.push(toHex(data));
    }
  }
  return parts.join(" ");
}
