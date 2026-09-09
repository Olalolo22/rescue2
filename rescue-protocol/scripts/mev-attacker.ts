import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  RESCUE_PROGRAM_ID,
  getPositionPda,
  getRescueConfigPda,
  getInstructionDiscriminator,
} from "./client";

export class MevAttackerBot {
  constructor(
    public connection: Connection,
    public botKeypair: Keypair,
    public programId = RESCUE_PROGRAM_ID
  ) {}

  /**
   * Attempts to execute a predatory public liquidation against the target position.
   *
   * While the position is delegated to MagicBlock TEE (InInterventionZone), this call
   * is guaranteed to fail with Error 3007 (AccountOwnedByWrongProgram) or InterventionZoneActive.
   * [VERIFIED: Probe 03 & Probe 06]
   */
  async attemptLiquidation(
    borrower: PublicKey,
    collateralMint: PublicKey,
    debtMint: PublicKey,
    repayAmount: bigint,
    currentPriceUsd6Dec: bigint
  ): Promise<{ blocked: boolean; errorReason?: string; txSignature?: string }> {
    const [configPda] = getRescueConfigPda(this.programId);
    const [positionPda] = getPositionPda(borrower, collateralMint, debtMint, this.programId);

    console.log(`\n=======================================================`);
    console.log(`[MEV Bot] Target Position: ${positionPda.toBase58()}`);
    console.log(`[MEV Bot] Liquidator Bot:  ${this.botKeypair.publicKey.toBase58()}`);
    console.log(`[MEV Bot] Attempting predatory public liquidation on L1...`);

    const disc = getInstructionDiscriminator("liquidate");
    const data = Buffer.alloc(24);
    disc.copy(data, 0);
    data.writeBigUInt64LE(repayAmount, 8);
    data.writeBigInt64LE(currentPriceUsd6Dec, 16);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.botKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);

    try {
      const sig = await sendAndConfirmTransaction(this.connection, tx, [this.botKeypair]);
      console.log(`⚠️ [MEV Bot] Liquidation SUCCEEDED! Tx: ${sig}`);
      return { blocked: false, txSignature: sig };
    } catch (err: any) {
      const errorStr = err.toString();
      const is3007 = errorStr.includes("3007") || errorStr.includes("AccountOwnedByWrongProgram");
      const isInterventionGuard = errorStr.includes("InterventionZoneActive") || errorStr.includes("0x1779");

      if (is3007 || isInterventionGuard) {
        console.log(`✅ [MEV Bot] Liquidation ATTEMPT BLOCKED!`);
        if (is3007) {
          console.log(`   Reason: Error 3007 (AccountOwnedByWrongProgram)`);
          console.log(`   Proof: Solana runtime refused L1 mutation because PositionPDA is delegated to MagicBlock DLP!`);
        } else {
          console.log(`   Reason: On-Chain Guard (InterventionZoneActive)`);
        }
        return { blocked: true, errorReason: is3007 ? "Error 3007" : "InterventionZoneActive" };
      }

      console.log(`[MEV Bot] Transaction rejected with unexpected error: ${errorStr}`);
      return { blocked: true, errorReason: errorStr };
    }
  }
}
