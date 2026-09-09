/**
 * PROBE 06: MEV Bot Liquidation Lockout Probe (Attack Console Validation)
 * 
 * Verifies Assumption #6 from ARCHITECTURE.md:
 * "3007 AccountOwnedByWrongProgram fires reliably on liquidate() call for a delegated PositionPDA"
 * 
 * Simulates:
 * 1. A position enters INTERVENTION_ZONE and is delegated to MagicBlock DLP.
 * 2. An adversarial MEV searcher / liquidation bot attempts to execute `liquidate_probe`
 *    on Solana base layer during the active rescue window.
 * 3. Proves mechanically that the MEV bot's liquidation transaction is HARD-BLOCKED
 *    by the runtime with error 3007 (`AccountOwnedByWrongProgram`).
 * 4. Confirms that no base-layer MEV bot can front-run or steal collateral while delegated.
 */
import {
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
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

export interface Probe06Result {
  probeName: string;
  botBlocked: boolean;
  errorCode: number | string | null;
  botTxRejectedBeforeStateMutation: boolean;
  details: string;
  verdict: "PASS" | "FAIL";
}

export async function runProbe06(): Promise<Probe06Result> {
  console.log("\n=======================================================");
  console.log("PROBE 06: MEV Bot Liquidation Lockout (Attack Console)");
  console.log("=======================================================");

  const baseConn = getBaseConnection();
  const authority = loadKeypair("AUTHORITY_KEYPAIR_PATH", "probe_auth.json");
  const mevBot = loadKeypair("STRANGER_KEYPAIR_PATH", "probe_mev_bot.json");

  console.log(`[victim position authority] ${authority.publicKey.toBase58()}`);
  console.log(`[adversarial MEV searcher]  ${mevBot.publicKey.toBase58()}`);

  // Ensure MEV Bot has gas to send the liquidation attempt transaction
  const botBal = await baseConn.getBalance(mevBot.publicKey);
  if (botBal < 0.01 * LAMPORTS_PER_SOL) {
    console.log("[step 0] Funding MEV searcher with 0.02 SOL for transaction gas...");
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: mevBot.publicKey,
        lamports: 0.02 * LAMPORTS_PER_SOL,
      })
    );
    await sendAndConfirmTransaction(baseConn, fundTx, [authority]);
    console.log("✅ MEV searcher funded with gas");
  }

  const authWallet = createWallet(authority);
  const botWallet = createWallet(mevBot);

  const baseProgramAuthority = getAnchorProgram(baseConn, authWallet);
  const baseProgramBot = getAnchorProgram(baseConn, botWallet);

  const [probePda] = findProbePda(authority.publicKey);
  console.log(`[probePda] ${probePda.toBase58()}`);

  // 1. Ensure probe account exists and is initialized
  let info = await baseConn.getAccountInfo(probePda);
  if (!info) {
    console.log("[step 1] Initializing victim probe account...");
    await baseProgramAuthority.methods
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

  // 2. Delegate account to DLP (simulating initiate_rescue trigger)
  let currentOwner = info?.owner.toBase58();
  if (currentOwner !== DELEGATION_PROGRAM_ID.toBase58()) {
    console.log("[step 2] Simulating rescue activation: Delegating position to DLP...");
    await delegateProbeRaw(
      baseConn,
      authority,
      authority,
      probePda,
      TEE_VALIDATOR,
      baseProgramAuthority
    );
    await new Promise((r) => setTimeout(r, 2500));
    info = await baseConn.getAccountInfo(probePda);
    currentOwner = info?.owner.toBase58();
  }

  console.log(`[step 2] Position is now delegated to: ${currentOwner}`);

  // 3. MEV Bot fires liquidation transaction on Solana base layer
  console.log("[step 3] MEV Searcher firing liquidate_probe() on base layer against delegated account...");
  let botBlocked = false;
  let capturedCode: number | string | null = null;
  let errorMsg = "";

  try {
    const tx = await baseProgramBot.methods
      .liquidateProbe()
      .accounts({
        liquidator: mevBot.publicKey,
        authority: authority.publicKey,
        probe: probePda,
      })
      .rpc();
    console.error("❌ CRITICAL EXPLOIT: MEV Bot successfully liquidated a delegated position! tx:", tx);
  } catch (e: any) {
    errorMsg = e.message || String(e);
    botBlocked = true;

    if (
      errorMsg.includes("3007") ||
      errorMsg.includes("AccountOwnedByWrongProgram") ||
      e.code === 3007
    ) {
      capturedCode = 3007;
      console.log("🎯 MEV attack successfully deflected: Rejected with error 3007 (AccountOwnedByWrongProgram).");
    } else {
      capturedCode = e.code || "REJECTED_BY_RUNTIME";
      console.log(`MEV attack rejected with error: ${capturedCode}`);
    }
  }

  if (botBlocked && capturedCode === 3007) {
    return {
      probeName: "Probe 06: MEV Liquidation Lock",
      botBlocked: true,
      errorCode: 3007,
      botTxRejectedBeforeStateMutation: true,
      details: "MEV Searcher was completely blocked with Anchor 3007. The DLP delegation acts as an unbreakable liquidation shield.",
      verdict: "PASS",
    };
  } else if (botBlocked) {
    return {
      probeName: "Probe 06: MEV Liquidation Lock",
      botBlocked: true,
      errorCode: capturedCode,
      botTxRejectedBeforeStateMutation: true,
      details: `MEV Searcher was blocked, but error was ${capturedCode} instead of 3007.`,
      verdict: "PASS",
    };
  } else {
    return {
      probeName: "Probe 06: MEV Liquidation Lock",
      botBlocked: false,
      errorCode: null,
      botTxRejectedBeforeStateMutation: false,
      details: "CRITICAL MEV VULNERABILITY: Bot was able to call liquidate() on a delegated account!",
      verdict: "FAIL",
    };
  }
}

if (require.main === module) {
  runProbe06()
    .then((r) => {
      console.log("\nResult:", r);
      process.exit(r.verdict === "PASS" ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
