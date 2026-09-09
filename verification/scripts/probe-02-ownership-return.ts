/**
 * PROBE 02: Program CPI Undelegate & Ownership Return Latency Probe
 * 
 * Verifies Assumption #2 from ARCHITECTURE.md:
 * "After program CPI undelegate, ownership returns within 2-30s on public TEE"
 * 
 * Tests whether:
 * 1. Invoking `undelegate_probe` via Program CPI (MagicIntentBundleBuilder) on TEE ER
 *    commits the account and undelegates cleanly without client-side commit instructions.
 * 2. Ownership on Solana base layer returns from DLP (`DELeGATE...`) back to `PROBE_PROGRAM_ID`.
 * 3. Measures the exact return latency in seconds against the 30s threshold.
 */
import { PublicKey } from "@solana/web3.js";
import {
  getBaseConnection,
  getErConnection,
  loadKeypair,
  createWallet,
  getAnchorProgram,
  findProbePda,
  authorizeSigner,
  waitForProgramOwnership,
  TEE_VALIDATOR,
  delegateProbeRaw,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  PROBE_PROGRAM_ID,
  DELEGATION_PROGRAM_ID,
} from "./common";

export interface Probe02Result {
  probeName: string;
  undelegateTxSuccess: boolean;
  returnedWithinSla: boolean;
  elapsedSeconds: number;
  details: string;
  verdict: "PASS" | "WARN_HIGH_LATENCY" | "FAIL";
}

export async function runProbe02(): Promise<Probe02Result> {
  console.log("\n=======================================================");
  console.log("PROBE 02: CPI Undelegate & Ownership Return Latency");
  console.log("=======================================================");

  const baseConn = getBaseConnection();
  const authority = loadKeypair("AUTHORITY_KEYPAIR_PATH", "probe_auth.json");
  const authWallet = createWallet(authority);
  const baseProgram = getAnchorProgram(baseConn, authWallet);

  const [probePda] = findProbePda(authority.publicKey);
  console.log(`[probePda] ${probePda.toBase58()}`);

  // 1. Ensure probe account is currently delegated to DLP
  let info = await baseConn.getAccountInfo(probePda);
  if (!info) {
    console.log("[step 1] Account does not exist on base. Initializing...");
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

  const currentOwner = info?.owner.toBase58();
  console.log(`[step 1] Current base owner: ${currentOwner}`);

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
    console.log("✅ Delegation transaction sent. Waiting 3s for ER propagation...");
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Verify delegated owner is DLP
  const delegatedInfo = await baseConn.getAccountInfo(probePda);
  console.log(`[step 2] Base owner after delegate: ${delegatedInfo?.owner.toBase58()}`);

  // 2. Authorize on TEE and connect to ER
  console.log("[step 3] Authorizing on TEE ER...");
  const token = await authorizeSigner(authority);
  const erConn = getErConnection(token);
  const erProgram = getAnchorProgram(erConn, authWallet);

  // 3. Invoke undelegate_probe CPI on TEE ER
  console.log("[step 4] Invoking undelegate_probe CPI on TEE ER...");
  let undTx: string;
  try {
    undTx = await erProgram.methods
      .undelegateProbe()
      .accounts({
        payer: authority.publicKey,
        probe: probePda,
        magicContext: MAGIC_CONTEXT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      .rpc();
    console.log(`✅ undelegate_probe CPI transaction confirmed on ER: ${undTx}`);
  } catch (e: any) {
    console.error("❌ Failed to execute undelegate_probe on ER:", e.message || e);
    return {
      probeName: "Probe 02: Ownership Return",
      undelegateTxSuccess: false,
      returnedWithinSla: false,
      elapsedSeconds: 0,
      details: `ER undelegate CPI failed: ${e.message}`,
      verdict: "FAIL",
    };
  }

  // 4. Poll base layer for ownership return back to PROBE_PROGRAM_ID
  console.log("[step 5] Polling Solana base layer for ownership return (SLA <= 30s)...");
  const pollResult = await waitForProgramOwnership(
    baseConn,
    probePda,
    PROBE_PROGRAM_ID,
    60 // max 60 seconds
  );

  console.log(`[step 5] Poll finished: success=${pollResult.success}, elapsed=${pollResult.elapsedSeconds.toFixed(1)}s, finalOwner=${pollResult.owner}`);

  if (pollResult.success && pollResult.elapsedSeconds <= 30) {
    return {
      probeName: "Probe 02: Ownership Return",
      undelegateTxSuccess: true,
      returnedWithinSla: true,
      elapsedSeconds: pollResult.elapsedSeconds,
      details: `Ownership cleanly returned to program in ${pollResult.elapsedSeconds.toFixed(1)}s (within <= 30s SLA).`,
      verdict: "PASS",
    };
  } else if (pollResult.success && pollResult.elapsedSeconds > 30) {
    return {
      probeName: "Probe 02: Ownership Return",
      undelegateTxSuccess: true,
      returnedWithinSla: false,
      elapsedSeconds: pollResult.elapsedSeconds,
      details: `Ownership returned, but took ${pollResult.elapsedSeconds.toFixed(1)}s (> 30s SLA). Adjust RESCUE_WINDOW_DURATION accordingly.`,
      verdict: "WARN_HIGH_LATENCY",
    };
  } else {
    return {
      probeName: "Probe 02: Ownership Return",
      undelegateTxSuccess: true,
      returnedWithinSla: false,
      elapsedSeconds: pollResult.elapsedSeconds,
      details: `Failed to return ownership after 60s. Account remains DLP-owned (${pollResult.owner}).`,
      verdict: "FAIL",
    };
  }
}

if (require.main === module) {
  runProbe02()
    .then((r) => {
      console.log("\nResult:", r);
      process.exit(r.verdict === "FAIL" ? 1 : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
