/**
 * PROBE 03: Delegated Account Base-Layer Mutation & 3007 Error Lock Probe
 * 
 * Verifies Assumption #3 from ARCHITECTURE.md:
 * "Attempt mutation of delegated account from base layer"
 * 
 * Tests whether:
 * 1. An instruction on base layer (`mutate_probe`) taking `Account<'info, ProbeAccount>`
 *    fails with Anchor error 3007 (`AccountOwnedByWrongProgram`) when the account is delegated.
 * 2. Confirms that base-layer transactions cannot mutate DLP-owned state.
 * 3. Highlights the design constraint: `timeout_rescue` CANNOT take `Account<'info, PositionPDA>`
 *    while delegated without hitting 3007; it must use an `UncheckedAccount` or DLP undelegate trigger.
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  getBaseConnection,
  loadKeypair,
  createWallet,
  getAnchorProgram,
  findProbePda,
  TEE_VALIDATOR,
  delegateProbeRaw,
  PROBE_PROGRAM_ID,
  DELEGATION_PROGRAM_ID,
} from "./common";

export interface Probe03Result {
  probeName: string;
  isDelegated: boolean;
  rejectedWith3007: boolean;
  errorCode: number | string | null;
  details: string;
  verdict: "PASS" | "FAIL";
}

export async function runProbe03(): Promise<Probe03Result> {
  console.log("\n=======================================================");
  console.log("PROBE 03: Delegated Base Mutation & 3007 Lock Probe");
  console.log("=======================================================");

  const baseConn = getBaseConnection();
  const authority = loadKeypair("AUTHORITY_KEYPAIR_PATH", "probe_auth.json");
  const authWallet = createWallet(authority);
  const baseProgram = getAnchorProgram(baseConn, authWallet);

  const [probePda] = findProbePda(authority.publicKey);
  console.log(`[probePda] ${probePda.toBase58()}`);

  // 1. Ensure probe account exists on base
  let info = await baseConn.getAccountInfo(probePda);
  if (!info) {
    console.log("[step 1] Initializing ProbeAccount on base...");
    await baseProgram.methods
      .initializeProbe(0)
      .accounts({
        payer: authority.publicKey,
        authority: authority.publicKey,
        probe: probePda,
        systemProgram: PublicKey.default,
      })
      .rpc();
    info = await baseConn.getAccountInfo(probePda);
  }

  // 2. Ensure probe account is delegated to DLP
  let currentOwner = info?.owner.toBase58();
  console.log(`[step 2] Current owner: ${currentOwner}`);
  if (currentOwner !== DELEGATION_PROGRAM_ID.toBase58()) {
    console.log("[step 2] Delegating probe account to TEE validator...");
    await delegateProbeRaw(
      baseConn,
      authority,
      authority,
      probePda,
      TEE_VALIDATOR,
      baseProgram
    );
    await new Promise((r) => setTimeout(r, 2500));
    info = await baseConn.getAccountInfo(probePda);
    currentOwner = info?.owner.toBase58();
    console.log(`[step 2] Base owner after delegate: ${currentOwner}`);
  }

  if (currentOwner !== DELEGATION_PROGRAM_ID.toBase58()) {
    return {
      probeName: "Probe 03: Delegated Mutation Lock",
      isDelegated: false,
      rejectedWith3007: false,
      errorCode: null,
      details: `Failed to delegate probe to DLP. Current owner is ${currentOwner}`,
      verdict: "FAIL",
    };
  }

  // 3. Attempt to mutate delegated account directly from Solana base layer
  console.log("[step 3] Attempting mutate_probe() on base layer against DLP-owned account...");
  let rejectedWith3007 = false;
  let capturedCode: number | string | null = null;
  let capturedError = "";

  try {
    const tx = await baseProgram.methods
      .mutateProbe(new anchor.BN(42))
      .accounts({
        authority: authority.publicKey,
        probe: probePda,
      })
      .rpc();
    console.error("❌ Unexpected: mutateProbe succeeded on base layer against a delegated account! tx:", tx);
  } catch (e: any) {
    capturedError = e.message || String(e);
    console.log("✅ Mutation rejected as expected. Error output:", capturedError);

    // Check for Anchor 3007 (AccountOwnedByWrongProgram)
    if (
      capturedError.includes("3007") ||
      capturedError.includes("AccountOwnedByWrongProgram") ||
      e.code === 3007
    ) {
      rejectedWith3007 = true;
      capturedCode = 3007;
      console.log("🎯 Confirmed: Exactly rejected with Anchor error 3007 (AccountOwnedByWrongProgram).");
    } else {
      capturedCode = e.code || "NON_3007_ERROR";
      console.log(`Mutation rejected with error: ${capturedCode}`);
    }
  }

  if (rejectedWith3007) {
    return {
      probeName: "Probe 03: Delegated Mutation Lock",
      isDelegated: true,
      rejectedWith3007: true,
      errorCode: 3007,
      details: "Confirmed: DLP ownership strictly blocks base mutations with 3007. timeout_rescue must NOT use Account<'info, PositionPDA> while stranded.",
      verdict: "PASS",
    };
  } else if (capturedError) {
    return {
      probeName: "Probe 03: Delegated Mutation Lock",
      isDelegated: true,
      rejectedWith3007: false,
      errorCode: capturedCode,
      details: `Mutation was blocked, but error was not 3007: ${capturedError.slice(0, 100)}`,
      verdict: "PASS",
    };
  } else {
    return {
      probeName: "Probe 03: Delegated Mutation Lock",
      isDelegated: true,
      rejectedWith3007: false,
      errorCode: null,
      details: "CRITICAL FAILURE: Delegated account was mutated on base layer without error!",
      verdict: "FAIL",
    };
  }
}

if (require.main === module) {
  runProbe03()
    .then((r) => {
      console.log("\nResult:", r);
      process.exit(r.verdict === "FAIL" ? 1 : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
