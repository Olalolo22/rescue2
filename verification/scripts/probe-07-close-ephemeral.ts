/**
 * PROBE 07: Ephemeral Account Lifecycle & Zero-L1-Trace Cleanup Probe
 * 
 * Verifies Assumption #7 from ARCHITECTURE.md:
 * "close_ephemeral_account cleans up LenderBidPDA on ER without leaving state on L1"
 * 
 * Tests:
 * 1. An ephemeral account (simulating private LenderBidPDA) is initialized directly on TEE ER.
 * 2. Proves the account exists on TEE ER but has 0 presence on Solana base layer.
 * 3. Closes the ephemeral account on TEE ER (refunding rent lamports).
 * 4. Verifies the account is purged from TEE ER and leaves ZERO trace on Solana base layer.
 */
import * as anchor from "@coral-xyz/anchor";
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
  findEphemeralPda,
  findProbePda,
  authorizeSigner,
  delegateProbeRaw,
  delegateAccountRaw,
  TEE_VALIDATOR,
  DELEGATION_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
} from "./common";

export interface Probe07Result {
  probeName: string;
  createdOnEr: boolean;
  neverExistedOnBase: boolean;
  closedOnEr: boolean;
  zeroFootprintOnBase: boolean;
  details: string;
  verdict: "PASS" | "FAIL";
}

export async function runProbe07(): Promise<Probe07Result> {
  console.log("\n=======================================================");
  console.log("PROBE 07: Ephemeral Account Lifecycle & Zero-L1-Trace");
  console.log("=======================================================");

  const baseConn = getBaseConnection();
  const mainPayer = loadKeypair("AUTHORITY_KEYPAIR_PATH", "probe_auth.json");

  // Create fresh authority for this run to guarantee unpolluted state on TEE ER
  const authority = Keypair.generate();
  const authWallet = createWallet(authority);
  const baseProgram = getAnchorProgram(baseConn, authWallet);

  const [probePda] = findProbePda(authority.publicKey);
  const [itemPda] = findEphemeralPda(authority.publicKey);
  console.log(`[authority (fresh)]   ${authority.publicKey.toBase58()}`);
  console.log(`[main payer]          ${mainPayer.publicKey.toBase58()}`);
  console.log(`[probePda]          ${probePda.toBase58()}`);
  console.log(`[ephemeralItemPda]  ${itemPda.toBase58()}`);

  // 0. Fund fresh authority with SOL on base layer
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

  // 0b. Initialize fresh probe account on base and delegate to TEE validator
  console.log("[step 0] Initializing probe account on base...");
  await baseProgram.methods
    .initializeProbe(0)
    .accounts({
      payer: authority.publicKey,
      authority: authority.publicKey,
      probe: probePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("[step 0] Delegating probe account to anchor ER session...");
  await delegateProbeRaw(
    baseConn,
    authority,  // payer (fresh funded)
    authority,  // authority
    probePda,
    TEE_VALIDATOR,
    baseProgram
  );

  console.log("[step 0] Delegating authority account to TEE validator for ER fee payer mutation...");
  await delegateAccountRaw(
    baseConn,
    mainPayer,  // main payer funds delegation buffer rent
    authority,  // authority is delegated to TEE validator
    SystemProgram.programId,
    TEE_VALIDATOR
  );
  console.log("✅ Probe & authority delegated to TEE validator, waiting 3s for ER sync...");
  await new Promise((r) => setTimeout(r, 3000));

  // 1. Authorize on TEE and get ER connection
  console.log("[step 1] Authorizing on TEE ER...");
  const authToken = await authorizeSigner(authority);
  const erConn = getErConnection(authToken);
  const erProgram = getAnchorProgram(erConn, authWallet);

  // 2. Create ephemeral item directly on ER
  console.log("[step 2] Creating ephemeral item directly on TEE ER...");
  try {
    const tx = await erProgram.methods
      .createEphemeralItem(new anchor.BN(99999))
      .accounts({
        authority: authority.publicKey,
        item: itemPda,
        vault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
      } as any)
      .remainingAccounts([
        { pubkey: probePda, isWritable: true, isSigner: false },
      ])
      .rpc({ skipPreflight: true });
    console.log(`✅ Ephemeral item created on ER. tx: ${tx}`);
  } catch (e: any) {
    const errText = e.logs ? `${e.message || e}\nLogs: ${e.logs.join("\n")}` : (e.message || String(e));
    console.error("❌ Failed to create ephemeral item on ER:", errText);
    return {
      probeName: "Probe 07: Ephemeral Cleanup",
      createdOnEr: false,
      neverExistedOnBase: false,
      closedOnEr: false,
      zeroFootprintOnBase: false,
      details: `Failed to create ephemeral item on ER: ${errText}`,
      verdict: "FAIL",
    };
  }

  // 3. Verify existence on ER
  console.log("[step 3] Checking state on ER...");
  const erInfo = await erConn.getAccountInfo(itemPda);
  const existsOnEr = !!(erInfo && erInfo.data.length > 0);
  console.log(`ER account status: exists=${existsOnEr}, len=${erInfo?.data.length || 0}`);

  // 4. Verify NON-existence on Solana Base layer
  console.log("[step 4] Verifying account is NOT on Solana base layer...");
  const baseInfoBefore = await baseConn.getAccountInfo(itemPda);
  const neverExistedOnBase = baseInfoBefore === null;
  console.log(`Base layer status: exists=${!neverExistedOnBase} (expected false)`);

  // 5. Close ephemeral account on ER
  console.log("[step 5] Closing ephemeral item on TEE ER...");
  try {
    const closeTx = await erProgram.methods
      .closeEphemeralItem()
      .accounts({
        authority: authority.publicKey,
        item: itemPda,
        vault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
      } as any)
      .remainingAccounts([
        { pubkey: probePda, isWritable: true, isSigner: false },
      ])
      .rpc({ skipPreflight: true });
    console.log(`✅ Ephemeral item closed on ER. tx: ${closeTx}`);
  } catch (e: any) {
    const errText = e.logs ? `${e.message || e}\nLogs: ${e.logs.join("\n")}` : (e.message || String(e));
    console.error("❌ Failed to close ephemeral item on ER:", errText);
    return {
      probeName: "Probe 07: Ephemeral Cleanup",
      createdOnEr: existsOnEr,
      neverExistedOnBase,
      closedOnEr: false,
      zeroFootprintOnBase: false,
      details: `Failed to close ephemeral item: ${errText}`,
      verdict: "FAIL",
    };
  }

  // 6. Verify ER account is gone / empty
  console.log("[step 6] Verifying ER account is wiped...");
  const erInfoAfter = await erConn.getAccountInfo(itemPda);
  const closedOnEr = !erInfoAfter || erInfoAfter.lamports === 0 || erInfoAfter.data.length === 0;
  console.log(`ER account post-close: wiped=${closedOnEr}`);

  // 7. Verify base layer still has zero trace
  console.log("[step 7] Verifying base layer has zero footprint...");
  const baseInfoAfter = await baseConn.getAccountInfo(itemPda);
  const zeroFootprintOnBase = baseInfoAfter === null;
  console.log(`Base layer post-close: exists=${!zeroFootprintOnBase} (expected false)`);

  const passed = existsOnEr && neverExistedOnBase && closedOnEr && zeroFootprintOnBase;

  return {
    probeName: "Probe 07: Ephemeral Cleanup",
    createdOnEr: existsOnEr,
    neverExistedOnBase,
    closedOnEr,
    zeroFootprintOnBase,
    details: passed
      ? "LenderBidPDA lifecycle confirmed: Exists purely on ER and closes with 0 base layer trace."
      : "Ephemeral lifecycle failed invariant checks.",
    verdict: passed ? "PASS" : "FAIL",
  };
}

if (require.main === module) {
  runProbe07()
    .then((r) => {
      console.log("\nResult:", r);
      process.exit(r.verdict === "PASS" ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
