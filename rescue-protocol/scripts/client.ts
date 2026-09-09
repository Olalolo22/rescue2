import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";

export const RESCUE_PROGRAM_ID = new PublicKey(
  process.env.RESCUE_PROGRAM_ID || "GCcUbgthDu323rfq9Z3iWNFR632wXWMZ66KKtdTtxDBT"
);

export const TEE_VALIDATOR = new PublicKey(
  process.env.TEE_VALIDATOR_DEVNET || "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo"
);

export const DELEGATION_PROGRAM_ID = new PublicKey(
  process.env.DELEGATION_PROGRAM_ID || "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);

// ─────────────────────────────────────────────────────────────────────────────
//  PDA Derivations
// ─────────────────────────────────────────────────────────────────────────────

export function getRescueConfigPda(programId = RESCUE_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rescue_config")],
    programId
  );
}

export function getPositionPda(
  owner: PublicKey,
  collateralMint: PublicKey,
  debtMint: PublicKey,
  programId = RESCUE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      owner.toBuffer(),
      collateralMint.toBuffer(),
      debtMint.toBuffer(),
    ],
    programId
  );
}

export function getRescueSessionPda(
  position: PublicKey,
  rescueIndex: number,
  programId = RESCUE_PROGRAM_ID
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(2);
  indexBuf.writeUInt16LE(rescueIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("session"), position.toBuffer(), indexBuf],
    programId
  );
}

export function getRescueRecordPda(
  position: PublicKey,
  rescueIndex: number,
  programId = RESCUE_PROGRAM_ID
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(2);
  indexBuf.writeUInt16LE(rescueIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rescue_record"), position.toBuffer(), indexBuf],
    programId
  );
}

export function getDelegateBufferPda(
  pda: PublicKey,
  programId = RESCUE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), pda.toBuffer()],
    programId
  );
}

export function getDelegationRecordPda(
  pda: PublicKey,
  delegationProgram = DELEGATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), pda.toBuffer()],
    delegationProgram
  );
}

export function getDelegationMetadataPda(
  pda: PublicKey,
  delegationProgram = DELEGATION_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), pda.toBuffer()],
    delegationProgram
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Instruction Discriminators & Decoders
// ─────────────────────────────────────────────────────────────────────────────

export function getInstructionDiscriminator(name: string): Buffer {
  const hash = anchor.utils.sha256.hash(`global:${name}`);
  return Buffer.from(hash.substring(0, 16), "hex");
}
