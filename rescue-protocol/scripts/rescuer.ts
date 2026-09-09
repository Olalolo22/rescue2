import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  RESCUE_PROGRAM_ID,
  getPositionPda,
  getRescueSessionPda,
  getRescueConfigPda,
  getRescueRecordPda,
  getInstructionDiscriminator,
} from "./client";

export class RescuerBot {
  constructor(
    public l1Connection: Connection,
    public teeConnection: Connection,
    public rescuerKeypair: Keypair,
    public programId = RESCUE_PROGRAM_ID
  ) {}

  /**
   * Submit sealed reverse-auction bid inside TEE ER
   */
  async submitBid(
    position: PublicKey,
    rescueIndex: number,
    penaltyBps: number,
    bondAmount: bigint
  ): Promise<string> {
    const [sessionPda] = getRescueSessionPda(position, rescueIndex, this.programId);

    const disc = getInstructionDiscriminator("submit_bid");
    const data = Buffer.alloc(18);
    disc.copy(data, 0);
    data.writeUInt16LE(penaltyBps, 8);
    data.writeBigUInt64LE(bondAmount, 10);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.rescuerKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: sessionPda, isSigner: false, isWritable: true },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.teeConnection, tx, [this.rescuerKeypair]);
    console.log(
      `[Rescuer ${this.rescuerKeypair.publicKey.toBase58().substring(0, 6)}] Sealed Bid Submitted on TEE: ${penaltyBps} bps! Tx: ${sig}`
    );
    return sig;
  }

  /**
   * Close auction window on TEE ER and match winning terms
   */
  async closeWindow(
    position: PublicKey,
    rescueIndex: number,
    matchPriceUsd6Dec: bigint
  ): Promise<string> {
    const [sessionPda] = getRescueSessionPda(position, rescueIndex, this.programId);

    const disc = getInstructionDiscriminator("close_window");
    const data = Buffer.alloc(16);
    disc.copy(data, 0);
    data.writeBigInt64LE(matchPriceUsd6Dec, 8);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.rescuerKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: sessionPda, isSigner: false, isWritable: true },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.teeConnection, tx, [this.rescuerKeypair]);
    console.log(`[Rescuer] Auction window closed on TEE. Tx: ${sig}`);
    return sig;
  }

  /**
   * Commit state & undelegate PositionPDA back to Solana L1
   */
  async undelegatePosition(positionPda: PublicKey): Promise<string> {
    const disc = getInstructionDiscriminator("undelegate_position");
    const data = Buffer.alloc(8);
    disc.copy(data, 0);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.rescuerKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: MAGIC_CONTEXT_ID, isSigner: false, isWritable: true },
        { pubkey: MAGIC_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.teeConnection, tx, [this.rescuerKeypair]);
    console.log(`[Rescuer] Position state committed and undelegated to L1. Tx: ${sig}`);
    return sig;
  }

  /**
   * Atomic L1 Settlement: Repays debt, seizes collateral, updates state to Rescued
   */
  async finalizeRescue(
    borrower: PublicKey,
    collateralMint: PublicKey,
    debtMint: PublicKey,
    rescueIndex: number,
    currentPriceUsd6Dec: bigint
  ): Promise<{ sig: string; recordPda: PublicKey }> {
    const [configPda] = getRescueConfigPda(this.programId);
    const [positionPda] = getPositionPda(borrower, collateralMint, debtMint, this.programId);
    const [sessionPda] = getRescueSessionPda(positionPda, rescueIndex, this.programId);
    const [recordPda] = getRescueRecordPda(positionPda, rescueIndex, this.programId);

    const disc = getInstructionDiscriminator("finalize_rescue");
    const data = Buffer.alloc(16);
    disc.copy(data, 0);
    data.writeBigInt64LE(currentPriceUsd6Dec, 8);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.rescuerKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: sessionPda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: recordPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.l1Connection, tx, [this.rescuerKeypair]);
    console.log(`🎉 [Rescuer] Rescue finalized on L1! Audit Record: ${recordPda.toBase58()}`);
    console.log(`   Tx: ${sig}`);
    return { sig, recordPda };
  }
}
