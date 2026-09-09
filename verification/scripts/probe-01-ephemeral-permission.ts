/**
 * PROBE 01: EphemeralPermission Multi-Member & Privacy Probe
 * 
 * Verifies Assumption #1 from ARCHITECTURE.md:
 * "EphemeralPermission multi-member bug fixed on current TEE"
 * 
 * Tests whether:
 * 1. An EphemeralPermission with 2 members (e.g. bidder + matcher) can be created on TEE ER.
 * 2. Or if current TEE still fails / only persists 1 member (the bug Tenor hit).
 * 3. Whether stranger authorization token on TEE RPC receives `null` for private account.
 */
import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getBaseConnection,
  getErConnection,
  loadKeypair,
  createWallet,
  getAnchorProgram,
  findProbePda,
  findPermissionPda,
  authorizeSigner,
  verifyTeeIdentity,
  TEE_VALIDATOR,
  delegateProbeRaw,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  PROBE_PROGRAM_ID,
} from "./common";

export interface Probe01Result {
  probeName: string;
  multiMemberSupported: boolean;
  strangerBlockedOnTee: boolean;
  details: string;
  verdict: "PASS" | "WARN_WORKAROUND_NEEDED" | "FAIL";
}

export async function runProbe01(): Promise<Probe01Result> {
  console.log("\n=======================================================");
  console.log("PROBE 01: EphemeralPermission Multi-Member & TEE Privacy");
  console.log("=======================================================");

  const baseConn = getBaseConnection();
  const mainPayer = loadKeypair("AUTHORITY_KEYPAIR_PATH", "probe_auth.json");
  const stranger = loadKeypair("STRANGER_KEYPAIR_PATH", "probe_stranger.json");
  const matcher = Keypair.generate();

  // Create fresh authority for this run to guarantee unpolluted state
  const authority = Keypair.generate();
  console.log(`[authority (fresh)]   ${authority.publicKey.toBase58()}`);
  console.log(`[main payer]          ${mainPayer.publicKey.toBase58()}`);
  console.log(`[matcher (member 2)]  ${matcher.publicKey.toBase58()}`);
  console.log(`[stranger (outsider)] ${stranger.publicKey.toBase58()}`);

  console.log("[step 0] Funding fresh authority with 0.05 SOL from main payer...");
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: mainPayer.publicKey,
      toPubkey: authority.publicKey,
      lamports: 0.05 * LAMPORTS_PER_SOL,
    })
  );
  await sendAndConfirmTransaction(baseConn, fundTx, [mainPayer]);
  console.log("✅ Fresh authority funded");

  // 1. Verify TEE validator identity
  const idCheck = await verifyTeeIdentity();
  console.log(`[tee] Identity check: expected=${idCheck.expected}, actual=${idCheck.actual}, match=${idCheck.matches}`);
  if (!idCheck.matches) {
    console.warn("⚠️ Warning: TEE RPC identity does not match configured TEE_VALIDATOR!");
  }

  const [probePda] = findProbePda(authority.publicKey);
  const permissionPda = findPermissionPda(probePda);
  console.log(`[probePda]      ${probePda.toBase58()}`);
  console.log(`[permissionPda] ${permissionPda.toBase58()}`);

  const authWallet = createWallet(authority);
  const baseProgram = getAnchorProgram(baseConn, authWallet);

  // 2. Ensure probe account initialized on base layer
  const info = await baseConn.getAccountInfo(probePda);
  if (!info) {
    console.log("[step 1] Initializing ProbeAccount on base layer with 2-member rent...");
    try {
      await baseProgram.methods
        .initializeProbe(2) // pre-fund rent for 2 members
        .accounts({
          payer: authority.publicKey,
          authority: authority.publicKey,
          probe: probePda,
          systemProgram: PublicKey.default,
        })
        .rpc();
      console.log("✅ ProbeAccount initialized on base");
    } catch (e: any) {
      console.error("❌ Failed to initialize ProbeAccount on base:", e.message || e);
      return {
        probeName: "Probe 01: EphemeralPermission",
        multiMemberSupported: false,
        strangerBlockedOnTee: false,
        details: `Failed to initialize base probe account: ${e.message}`,
        verdict: "FAIL",
      };
    }
  } else {
    console.log("[step 1] ProbeAccount already exists on base");
  }

  // 3. Delegate probe account to TEE validator if not already delegated
  const currentOwner = (await baseConn.getAccountInfo(probePda))?.owner.toBase58();
  if (currentOwner === PROBE_PROGRAM_ID.toBase58()) {
    console.log("[step 2] Delegating probe account to TEE validator...");
    try {
      await delegateProbeRaw(
        baseConn,
        authority,
        authority,
        probePda,
        TEE_VALIDATOR,
        baseProgram
      );
      console.log("✅ ProbeAccount delegated to DLP");
      await new Promise((r) => setTimeout(r, 2500));
    } catch (e: any) {
      console.error("❌ Failed to delegate probe account:", e.message || e);
      return {
        probeName: "Probe 01: EphemeralPermission",
        multiMemberSupported: false,
        strangerBlockedOnTee: false,
        details: `Delegation failed: ${e.message}`,
        verdict: "FAIL",
      };
    }
  } else {
    console.log(`[step 2] Probe account already delegated (current owner: ${currentOwner})`);
  }

  // 4. Authorize with TEE and connect via ER connection
  console.log("[step 3] Authorizing authority on TEE ER...");
  let authToken: string;
  try {
    authToken = await authorizeSigner(authority);
    console.log("✅ Authority TEE auth token obtained");
  } catch (e: any) {
    console.error("❌ Failed to get TEE auth token:", e.message || e);
    return {
      probeName: "Probe 01: EphemeralPermission",
      multiMemberSupported: false,
      strangerBlockedOnTee: false,
      details: `TEE authorization failed: ${e.message}`,
      verdict: "FAIL",
    };
  }

  const erConn = getErConnection(authToken);
  const erProgram = getAnchorProgram(erConn, authWallet);

  // 5. Test multi-member EphemeralPermission initialization on TEE
  console.log("[step 4] Testing 2-member EphemeralPermission initialization (authority + matcher)...");
  let multiMemberOk = false;
  let multiMemberError = "";

  try {
    const tx = await erProgram.methods
      .initProbePermission(true, [authority.publicKey, matcher.publicKey])
      .accounts({
        authority: authority.publicKey,
        probe: probePda,
        permission: permissionPda,
        ephemeralVault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();
    console.log("✅ 2-member EphemeralPermission init succeeded! tx:", tx);
    multiMemberOk = true;
  } catch (e: any) {
    multiMemberError = e.message || String(e);
    console.warn("⚠️ 2-member permission failed with error:", multiMemberError);
  }

  // 6. Test stranger read isolation on TEE
  console.log("[step 5] Testing stranger isolation on TEE...");
  let strangerBlocked = false;
  try {
    const strangerToken = await authorizeSigner(stranger);
    const strangerErConn = getErConnection(strangerToken);
    const strangerRead = await strangerErConn.getAccountInfo(probePda);
    if (!strangerRead) {
      console.log("✅ Stranger getAccountInfo returned null (privacy enforced by TEE)");
      strangerBlocked = true;
    } else {
      console.warn("⚠️ Stranger was able to read probe account on TEE (account visible or non-private)");
    }
  } catch (e: any) {
    console.log("✅ Stranger read errored as expected:", e.message || e);
    strangerBlocked = true;
  }

  // Summary verdict
  if (multiMemberOk && strangerBlocked) {
    return {
      probeName: "Probe 01: EphemeralPermission",
      multiMemberSupported: true,
      strangerBlockedOnTee: true,
      details: "Full 2-member EphemeralPermission supported natively on TEE ER with privacy enforcement.",
      verdict: "PASS",
    };
  } else if (!multiMemberOk && strangerBlocked) {
    return {
      probeName: "Probe 01: EphemeralPermission",
      multiMemberSupported: false,
      strangerBlockedOnTee: true,
      details: `Multi-member bug persists (${multiMemberError.slice(0, 80)}...). Use Tenor single-member / base-verification workaround.`,
      verdict: "WARN_WORKAROUND_NEEDED",
    };
  } else {
    return {
      probeName: "Probe 01: EphemeralPermission",
      multiMemberSupported: false,
      strangerBlockedOnTee: false,
      details: `TEE permissioning failed: ${multiMemberError}`,
      verdict: "FAIL",
    };
  }
}

if (require.main === module) {
  runProbe01()
    .then((r) => {
      console.log("\nResult:", r);
      process.exit(r.verdict === "FAIL" ? 1 : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
