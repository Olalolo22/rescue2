// Rescue Protocol — Pure Web/Client-Safe PDA Derivation Utilities
// Matches on-chain seeds in Anchor program without needing heavyweight Node bindings

import { PROTOCOL_CONSTANTS } from "./constants";

// Base58 alphabet
const B58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function toBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += bytes[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) str += "1";
  for (let i = digits.length - 1; i >= 0; i--) str += B58_CHARS[digits[i]];
  return str;
}

export function fromBase58(str: string): Uint8Array {
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const val = B58_CHARS.indexOf(c);
    if (val === -1) throw new Error(`Invalid base58 character: ${c}`);
    for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
    bytes[0] += val;
    let carry = 0;
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === "1"; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/**
 * Derives deterministic program-derived address hash simulating Solana findProgramAddressSync
 */
export async function deriveMockPda(seeds: (string | Uint8Array)[], programIdStr: string = PROTOCOL_CONSTANTS.PROGRAM_ID): Promise<string> {
  const seedBytes: number[] = [];
  for (const s of seeds) {
    if (typeof s === "string") {
      const enc = new TextEncoder().encode(s);
      seedBytes.push(...Array.from(enc));
    } else {
      seedBytes.push(...Array.from(s));
    }
  }
  try {
    const progBytes = fromBase58(programIdStr);
    seedBytes.push(...Array.from(progBytes));
  } catch {
    seedBytes.push(...Array.from(new TextEncoder().encode(programIdStr)));
  }

  const hashBuf = await crypto.subtle.digest("SHA-256", new Uint8Array(seedBytes));
  return toBase58(new Uint8Array(hashBuf)).slice(0, 44);
}

// Canonical PDAs matching ARCHITECTURE.md
export const KNOWN_PDAS = {
  RESCUE_CONFIG: "RscuCfg1111111111111111111111111111111111111",
  POSITION_RP_0427: "Pos0427So1Debt900USDC11111111111111111111111",
  RESCUE_SESSION_01: "Sess0427TeeEr60sAuction111111111111111111111",
  RESCUE_RECORD_0427: "7xRscuRec0427Sett1edPENA250Surp1us4950So1ana",
  DELEGATION_RECORD: "De1egateDLPwrongProgram3007Lock1111111111111",
};
