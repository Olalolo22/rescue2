/**
 * PROBE 05: Delegation Activation Latency vs Oracle Update Frequency Probe
 * 
 * Verifies Assumption #5 from ARCHITECTURE.md:
 * "Keeper can initiate rescue fast enough before HF hits liquidation boundary:
 * Measure Pyth feed frequency vs delegation latency"
 * 
 * Tests:
 * 1. Time from sending `delegate` transaction on Solana base to base confirmation (T_base).
 * 2. Time from base confirmation until the account is indexed and active on TEE ER (T_er).
 * 3. Total rescue activation latency: T_total = T_base + T_er.
 * 4. Compares T_total against typical Pyth oracle update intervals (1-3s) to quantify
 *    the exact risk zone and set the INTERVENTION_ZONE threshold buffer in the lending host.
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
  PROBE_PROGRAM_ID,
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "./common";

export interface Probe05Result {
  probeName: string;
  baseConfirmMs: number;
  erPropagationMs: number;
  totalActivationMs: number;
  recommendedHfBufferBps: number;
  details: string;
  verdict: "PASS" | "WARN_HIGH_LATENCY";
}

export async function runProbe05(): Promise<Probe05Result> {
  console.log("\n=======================================================");
  console.log("PROBE 05: Delegation Activation Latency vs Oracle Race");
  console.log("=======================================================");

  const baseConn = getBaseConnection();
  const authority = loadKeypair("AUTHORITY_KEYPAIR_PATH", "probe_auth.json");
  const authWallet = createWallet(authority);
  const baseProgram = getAnchorProgram(baseConn, authWallet);

  const [probePda] = findProbePda(authority.publicKey);
  console.log(`[probePda] ${probePda.toBase58()}`);

  // 1. Ensure probe account exists and is UNDELEGATED on base
  let info = await baseConn.getAccountInfo(probePda);
  if (!info) {
    console.log("[step 1] Initializing new probe account on base...");
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

  // If already delegated, we need to undelegate or wait
  if (info?.owner.toBase58() === DELEGATION_PROGRAM_ID.toBase58()) {
    console.log("[step 1] Account already delegated. Undelegating first to measure clean cycle...");
    const token = await authorizeSigner(authority);
    const erConn = getErConnection(token);
    const erProgram = getAnchorProgram(erConn, authWallet);

    await erProgram.methods
      .undelegateProbe()
      .accounts({
        payer: authority.publicKey,
        probe: probePda,
        magicContext: MAGIC_CONTEXT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      .rpc();

    await waitForProgramOwnership(baseConn, probePda, PROBE_PROGRAM_ID, 45);
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("[step 2] Measuring delegation activation latency...");
  const t0 = Date.now();

  // 2. Dispatch delegate transaction
  const delegateTx = await delegateProbeRaw(
    baseConn,
    authority,
    authority,
    probePda,
    TEE_VALIDATOR,
    baseProgram
  );

  const t1 = Date.now();
  const baseConfirmMs = t1 - t0;
  console.log(`✅ Base layer confirmation confirmed in: ${baseConfirmMs}ms (tx: ${delegateTx})`);

  // 3. Measure time until ER recognizes the account
  console.log("[step 3] Polling TEE ER until delegated account is queryable...");
  const authToken = await authorizeSigner(authority);
  const erConn = getErConnection(authToken);

  let erActive = false;
  let t2 = Date.now();
  for (let attempt = 0; attempt < 30; attempt++) {
    const erInfo = await erConn.getAccountInfo(probePda);
    if (erInfo && erInfo.data.length > 0) {
      t2 = Date.now();
      erActive = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  const erPropagationMs = erActive ? t2 - t1 : 99999;
  const totalActivationMs = baseConfirmMs + erPropagationMs;

  console.log(`✅ ER availability confirmed in: ${erPropagationMs}ms`);
  console.log(`⏱️ Total Activation Latency: ${totalActivationMs}ms`);

  // Compute recommended Health Factor buffer based on latency
  // Typical devnet price moves at ~50-100 bps per block in high volatility
  const recommendedHfBufferBps = totalActivationMs > 4000 ? 500 : 300; // 3-5% buffer

  const details = `Base confirmation: ${baseConfirmMs}ms, ER sync: ${erPropagationMs}ms, Total: ${totalActivationMs}ms. Recommended INTERVENTION_ZONE buffer: >=${recommendedHfBufferBps} bps above liquidation threshold.`;

  return {
    probeName: "Probe 05: Delegation Latency",
    baseConfirmMs,
    erPropagationMs,
    totalActivationMs,
    recommendedHfBufferBps,
    details,
    verdict: totalActivationMs <= 6000 ? "PASS" : "WARN_HIGH_LATENCY",
  };
}

if (require.main === module) {
  runProbe05()
    .then((r) => {
      console.log("\nResult:", r);
      process.exit(r.verdict === "PASS" ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
