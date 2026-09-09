import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  VersionedTransaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAuthToken,
  verifyTeeRpcIntegrity,
  EPHEMERAL_VAULT_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import nacl from "tweetnacl";

dotenv.config();

// -----------------------------------------------------------------------------
// Network Endpoints & Identifiers
// -----------------------------------------------------------------------------
export const BASE_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const BASE_WS_URL =
  process.env.SOLANA_WS_URL || "wss://api.devnet.solana.com";
export const ER_RPC_URL =
  process.env.MB_TEE_RPC_URL ||
  process.env.MB_ER_RPC_URL ||
  "https://devnet-tee.magicblock.app";
export const ER_WS_URL =
  process.env.MB_TEE_WS_URL || "wss://devnet-as.magicblock.app";

export const TEE_VALIDATOR = new PublicKey(
  process.env.TEE_VALIDATOR_DEVNET ||
    "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo"
);

export const DELEGATION_PROGRAM_ID = new PublicKey(
  process.env.DELEGATION_PROGRAM_ID ||
    "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);

export const PROBE_PROGRAM_ID = new PublicKey(
  process.env.PROBE_PROGRAM_ID || "ZnDqdjHjR1HuwyMehcfEGrxCt6QiCz58UW21VjbnGjf"
);

export const PYTH_FEED_DEVNET = new PublicKey(
  process.env.PYTH_PRICE_FEED_ACCOUNT ||
    "1121JSUgoCT514dycHuZRjPdDnXd1gvQ3wCixt8on1m"
);

export {
  EPHEMERAL_VAULT_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  permissionPdaFromAccount,
};

// -----------------------------------------------------------------------------
// Connection & Wallet Utilities
// -----------------------------------------------------------------------------

export class KeypairWallet implements anchor.Wallet {
  constructor(readonly payer: Keypair) {}

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T
  ): Promise<T> {
    if (tx instanceof VersionedTransaction) {
      tx.sign([this.payer]);
    } else {
      tx.partialSign(this.payer);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[]
  ): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }
}

export function createWallet(keypair: Keypair): anchor.Wallet {
  return new KeypairWallet(keypair);
}

export function getBaseConnection(): Connection {
  return new Connection(BASE_RPC_URL, {
    commitment: "confirmed",
    wsEndpoint: BASE_WS_URL,
  });
}

export function getErConnection(authToken?: string): Connection {
  const rpcUrl = authToken ? `${ER_RPC_URL}?token=${authToken}` : ER_RPC_URL;
  const wsUrl = authToken ? `${ER_WS_URL}?token=${authToken}` : ER_WS_URL;
  return new Connection(rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: wsUrl,
  });
}

export async function authorizeSigner(wallet: Keypair): Promise<string> {
  await verifyTeeRpcIntegrity(ER_RPC_URL);
  const authToken = await getAuthToken(
    ER_RPC_URL,
    wallet.publicKey,
    (message: Uint8Array) =>
      Promise.resolve(nacl.sign.detached(message, wallet.secretKey))
  );
  return authToken.token;
}

export async function verifyTeeIdentity(): Promise<{
  expected: string;
  actual: string;
  matches: boolean;
}> {
  const res = await fetch(ER_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getIdentity" }),
  }).then((r) => r.json());

  const actual = res.result?.identity || "UNKNOWN";
  const expected = TEE_VALIDATOR.toBase58();
  return {
    expected,
    actual,
    matches: actual === expected,
  };
}

export function loadKeypair(
  envVar: string,
  fallbackFilename = "probe_test_key.json"
): Keypair {
  const customPath = process.env[envVar];
  if (customPath && fs.existsSync(customPath)) {
    const raw = fs.readFileSync(customPath, "utf-8");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }

  // Check solana default config only for authority, not stranger
  if (envVar !== "STRANGER_KEYPAIR_PATH") {
    const solanaConfigKey = path.join(
      process.env.HOME || "",
      ".config",
      "solana",
      "id.json"
    );
    if (fs.existsSync(solanaConfigKey)) {
      const raw = fs.readFileSync(solanaConfigKey, "utf-8");
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    }
  }

  // Fallback to local temporary key
  const localKeyPath = path.join(__dirname, "..", fallbackFilename);
  if (fs.existsSync(localKeyPath)) {
    const raw = fs.readFileSync(localKeyPath, "utf-8");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }

  const generated = Keypair.generate();
  fs.writeFileSync(
    localKeyPath,
    JSON.stringify(Array.from(generated.secretKey)),
    "utf-8"
  );
  console.log(
    `[common] Generated ephemeral keypair at ${localKeyPath}: ${generated.publicKey.toBase58()}`
  );
  return generated;
}

// -----------------------------------------------------------------------------
// PDA Derivations
// -----------------------------------------------------------------------------

export function findProbePda(
  authority: PublicKey,
  programId = PROBE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("probe"), authority.toBuffer()],
    programId
  );
}

export function findEphemeralPda(
  authority: PublicKey,
  programId = PROBE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ephemeral_item"), authority.toBuffer()],
    programId
  );
}

export function findPermissionPda(account: PublicKey): PublicKey {
  return permissionPdaFromAccount(account);
}

// -----------------------------------------------------------------------------
// Delegation Helper (bypasses Anchor IDL for #[delegate]-injected accounts)
// The #[delegate] macro auto-injects these PDA accounts into DelegateProbe:
//   buffer_probe       seeds=[b"buffer", probe]          program=PROBE_PROGRAM_ID
//   delegation_record_probe  seeds=[b"delegation", probe]     program=DELEGATION_PROGRAM_ID
//   delegation_metadata_probe seeds=[b"delegation-metadata", probe] program=DELEGATION_PROGRAM_ID
//   owner_program      = PROBE_PROGRAM_ID
//   delegation_program = DELEGATION_PROGRAM_ID
//   system_program     = SystemProgram
// -----------------------------------------------------------------------------

export async function delegateProbeRaw(
  connection: Connection,
  payer: Keypair,
  authority: Keypair,
  probePda: PublicKey,
  validator: PublicKey,
  program: anchor.Program
): Promise<string> {
  const [bufferProbe] = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), probePda.toBuffer()],
    PROBE_PROGRAM_ID
  );
  const [delegationRecordProbe] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), probePda.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
  const [delegationMetadataProbe] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), probePda.toBuffer()],
    DELEGATION_PROGRAM_ID
  );

  const signers = [payer];
  if (!payer.publicKey.equals(authority.publicKey)) {
    signers.push(authority);
  }

  return program.methods
    .delegateProbe()
    .accounts({
      payer: payer.publicKey,
      authority: authority.publicKey,
      bufferProbe,
      delegationRecordProbe,
      delegationMetadataProbe,
      buffer_probe: bufferProbe,
      delegation_record_probe: delegationRecordProbe,
      delegation_metadata_probe: delegationMetadataProbe,
      probe: probePda,
      validator,
      ownerProgram: PROBE_PROGRAM_ID,
      owner_program: PROBE_PROGRAM_ID,
      delegationProgram: DELEGATION_PROGRAM_ID,
      delegation_program: DELEGATION_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      system_program: anchor.web3.SystemProgram.programId,
    } as any)
    .signers(signers)
    .rpc();
}

// -----------------------------------------------------------------------------
// Account Delegation Helper (for system/wallet accounts to allow ER state mutations)
// -----------------------------------------------------------------------------

export async function delegateAccountRaw(
  connection: Connection,
  payer: Keypair,
  accountToDelegate: Keypair,
  ownerProgram: PublicKey,
  validator: PublicKey
): Promise<string> {
  const [buffer] = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), accountToDelegate.publicKey.toBuffer()],
    ownerProgram
  );
  const [delegationRecord] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), accountToDelegate.publicKey.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
  const [delegationMetadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), accountToDelegate.publicKey.toBuffer()],
    DELEGATION_PROGRAM_ID
  );

  const bufferData = Buffer.alloc(8 + 4 + 4 + 1 + 32);
  bufferData.fill(0);
  bufferData.writeUInt32LE(0xffffffff, 8); // commitFrequencyMs
  bufferData.writeUInt32LE(0, 12); // seeds.length = 0
  bufferData.writeUInt8(1, 16); // has validator
  validator.toBuffer().copy(bufferData, 17);

  const keys = [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: accountToDelegate.publicKey, isSigner: true, isWritable: true },
    { pubkey: ownerProgram, isSigner: false, isWritable: false },
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: delegationRecord, isSigner: false, isWritable: true },
    { pubkey: delegationMetadata, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const tx = new Transaction();
  if (ownerProgram.equals(SystemProgram.programId)) {
    tx.add(
      SystemProgram.assign({
        accountPubkey: accountToDelegate.publicKey,
        programId: DELEGATION_PROGRAM_ID,
      })
    );
  }
  tx.add(
    new TransactionInstruction({
      programId: DELEGATION_PROGRAM_ID,
      keys,
      data: bufferData,
    })
  );

  const signers = [payer];
  if (!payer.publicKey.equals(accountToDelegate.publicKey)) {
    signers.push(accountToDelegate);
  }

  return sendAndConfirmTransaction(connection, tx, signers);
}

// -----------------------------------------------------------------------------
// Ownership Polling Helper (The Tenor-proven settlement pipe)
// -----------------------------------------------------------------------------

export async function waitForProgramOwnership(
  connection: Connection,
  account: PublicKey,
  expectedProgramId: PublicKey,
  maxWaitSeconds = 45
): Promise<{ success: boolean; elapsedSeconds: number; owner: string }> {
  const start = Date.now();
  for (let i = 0; i < maxWaitSeconds; i++) {
    const info = await connection.getAccountInfo(account);
    const owner = info?.owner ? info.owner.toBase58() : "UNALLOCATED";
    if (owner === expectedProgramId.toBase58()) {
      const elapsedSeconds = (Date.now() - start) / 1000;
      return { success: true, elapsedSeconds, owner };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const info = await connection.getAccountInfo(account);
  return {
    success: false,
    elapsedSeconds: (Date.now() - start) / 1000,
    owner: info?.owner?.toBase58() || "UNKNOWN",
  };
}

// -----------------------------------------------------------------------------
// Anchor Client Loader
// -----------------------------------------------------------------------------

export function getAnchorProgram(
  connection: Connection,
  wallet: anchor.Wallet,
  programId = PROBE_PROGRAM_ID
): anchor.Program {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Attempt to load IDL from target directory or fallback
  const idlPath = path.join(
    __dirname,
    "..",
    "target",
    "idl",
    "probe.json"
  );
  if (fs.existsSync(idlPath)) {
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    idl.address = programId.toBase58();
    return new anchor.Program(idl as any, provider);
  }

  // Fallback minimal IDL definition if target hasn't been built locally yet
  const minimalIdl: anchor.Idl = {
    version: "0.1.0",
    name: "probe",
    instructions: [
      {
        name: "initializeProbe",
        discriminator: [182, 94, 156, 201, 68, 48, 111, 224],
        accounts: [
          { name: "payer", writable: true, signer: true, isMut: true, isSigner: true },
          { name: "authority", writable: false, signer: true, isMut: false, isSigner: true },
          { name: "probe", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "systemProgram", writable: false, signer: false, isMut: false, isSigner: false },
        ],
        args: [{ name: "extraRentMembers", type: "u8" }],
      },
      {
        name: "delegateProbe",
        discriminator: [219, 98, 51, 77, 21, 218, 151, 164],
        accounts: [
          { name: "payer", writable: true, signer: true, isMut: true, isSigner: true },
          { name: "authority", writable: false, signer: true, isMut: false, isSigner: true },
          { name: "bufferProbe", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "delegationRecordProbe", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "delegationMetadataProbe", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "probe", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "validator", writable: false, signer: false, isMut: false, isSigner: false, optional: true, isOptional: true },
          { name: "ownerProgram", writable: false, signer: false, isMut: false, isSigner: false },
          { name: "delegationProgram", writable: false, signer: false, isMut: false, isSigner: false },
          { name: "systemProgram", writable: false, signer: false, isMut: false, isSigner: false },
        ],
        args: [],
      },
      {
        name: "mutateProbe",
        discriminator: [227, 158, 174, 0, 133, 255, 167, 140],
        accounts: [
          { name: "authority", writable: false, signer: true, isMut: false, isSigner: true },
          { name: "probe", writable: true, signer: false, isMut: true, isSigner: false },
        ],
        args: [{ name: "increment", type: "u64" }],
      },
      {
        name: "liquidateProbe",
        discriminator: [58, 121, 24, 92, 92, 127, 237, 27],
        accounts: [
          { name: "liquidator", writable: false, signer: true, isMut: false, isSigner: true },
          { name: "authority", writable: false, signer: false, isMut: false, isSigner: false },
          { name: "probe", writable: true, signer: false, isMut: true, isSigner: false },
        ],
        args: [],
      },
      {
        name: "initProbePermission",
        discriminator: [252, 22, 128, 219, 141, 29, 119, 184],
        accounts: [
          { name: "authority", writable: true, signer: true, isMut: true, isSigner: true },
          { name: "probe", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "permission", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "ephemeralVault", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "magicProgram", writable: false, signer: false, isMut: false, isSigner: false },
          { name: "permissionProgram", writable: false, signer: false, isMut: false, isSigner: false },
        ],
        args: [
          { name: "isPrivate", type: "bool" },
          { name: "members", type: { vec: "pubkey" } },
        ],
      },
      {
        name: "probeCrossRead",
        discriminator: [82, 223, 14, 174, 105, 156, 125, 20],
        accounts: [
          { name: "reader", writable: false, signer: true, isMut: false, isSigner: true },
          { name: "probe", writable: false, signer: false, isMut: false, isSigner: false },
        ],
        args: [],
      },
      {
        name: "undelegateProbe",
        discriminator: [102, 234, 184, 238, 155, 204, 55, 244],
        accounts: [
          { name: "payer", writable: true, signer: true, isMut: true, isSigner: true },
          { name: "probe", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "magicContext", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "magicProgram", writable: false, signer: false, isMut: false, isSigner: false },
        ],
        args: [],
      },
      {
        name: "createEphemeralItem",
        discriminator: [133, 182, 238, 134, 55, 116, 99, 177],
        accounts: [
          { name: "authority", writable: true, signer: true, isMut: true, isSigner: true },
          { name: "item", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "vault", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "magicProgram", writable: false, signer: false, isMut: false, isSigner: false },
        ],
        args: [{ name: "data", type: "u64" }],
      },
      {
        name: "closeEphemeralItem",
        discriminator: [59, 22, 246, 55, 41, 253, 93, 69],
        accounts: [
          { name: "authority", writable: true, signer: true, isMut: true, isSigner: true },
          { name: "item", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "vault", writable: true, signer: false, isMut: true, isSigner: false },
          { name: "magicProgram", writable: false, signer: false, isMut: false, isSigner: false },
        ],
        args: [],
      },
    ],
    accounts: [
      {
        name: "ProbeAccount",
        discriminator: [224, 127, 221, 245, 147, 179, 144, 243],
      },
      {
        name: "EphemeralItemAccount",
        discriminator: [208, 156, 95, 98, 13, 36, 240, 189],
      },
    ],
    types: [
      {
        name: "ProbeAccount",
        type: {
          kind: "struct",
          fields: [
            { name: "authority", type: "pubkey" },
            { name: "counter", type: "u64" },
            { name: "bump", type: "u8" },
          ],
        },
      },
      {
        name: "EphemeralItemAccount",
        type: {
          kind: "struct",
          fields: [
            { name: "authority", type: "pubkey" },
            { name: "data", type: "u64" },
            { name: "bump", type: "u8" },
          ],
        },
      },
    ],
  };

  (minimalIdl as any).address = programId.toBase58();
  return new anchor.Program(minimalIdl as any, provider);
}
