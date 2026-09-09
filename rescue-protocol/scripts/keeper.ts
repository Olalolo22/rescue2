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
  RESCUE_PROGRAM_ID,
  TEE_VALIDATOR,
  DELEGATION_PROGRAM_ID,
  getRescueConfigPda,
  getPositionPda,
  getRescueSessionPda,
  getDelegateBufferPda,
  getDelegationRecordPda,
  getDelegationMetadataPda,
  getInstructionDiscriminator,
} from "./client";

export interface PositionStatus {
  collateralAmount: bigint;
  debtAmount: bigint;
  state: number; // 0=Healthy, 1=AtRisk, 2=InInterventionZone, 3=Rescued, 4=Liquidatable
  rescueCount: number;
}

export class RescueKeeper {
  constructor(
    public connection: Connection,
    public keeperKeypair: Keypair,
    public programId = RESCUE_PROGRAM_ID
  ) {}

  /**
   * Monitor health factor and trigger flag_at_risk if HF <= 1.05
   */
  async flagAtRisk(
    owner: PublicKey,
    collateralMint: PublicKey,
    debtMint: PublicKey,
    currentPriceUsd6Dec: bigint
  ): Promise<string> {
    const [configPda] = getRescueConfigPda(this.programId);
    const [positionPda] = getPositionPda(owner, collateralMint, debtMint, this.programId);

    const disc = getInstructionDiscriminator("flag_at_risk");
    const data = Buffer.alloc(16);
    disc.copy(data, 0);
    data.writeBigInt64LE(currentPriceUsd6Dec, 8);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.keeperKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.connection, tx, [this.keeperKeypair]);
    console.log(`[Keeper] Position flagged AT_RISK! Tx: ${sig}`);
    return sig;
  }

  /**
   * Initiate rescue auction and delegate PositionPDA to MagicBlock TEE
   */
  async initiateRescue(
    payer: Keypair,
    owner: PublicKey,
    collateralMint: PublicKey,
    debtMint: PublicKey,
    rescueIndex: number,
    currentPriceUsd6Dec: bigint,
    validator = TEE_VALIDATOR
  ): Promise<{ sig: string; sessionPda: PublicKey }> {
    const [configPda] = getRescueConfigPda(this.programId);
    const [positionPda] = getPositionPda(owner, collateralMint, debtMint, this.programId);
    const [sessionPda] = getRescueSessionPda(positionPda, rescueIndex, this.programId);
    const [bufferPda] = getDelegateBufferPda(positionPda, this.programId);
    const [delegationRecordPda] = getDelegationRecordPda(positionPda, DELEGATION_PROGRAM_ID);
    const [delegationMetadataPda] = getDelegationMetadataPda(positionPda, DELEGATION_PROGRAM_ID);

    const disc = getInstructionDiscriminator("initiate_rescue");
    const data = Buffer.alloc(16);
    disc.copy(data, 0);
    data.writeBigInt64LE(currentPriceUsd6Dec, 8);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: sessionPda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: validator, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        // MagicBlock delegate macro expanded accounts
        { pubkey: this.programId, isSigner: false, isWritable: false }, // owner_program
        { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false }, // delegation_program
        { pubkey: bufferPda, isSigner: false, isWritable: true },
        { pubkey: delegationRecordPda, isSigner: false, isWritable: true },
        { pubkey: delegationMetadataPda, isSigner: false, isWritable: true },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.connection, tx, [payer]);
    console.log(`[Keeper] Rescue initiated! Position delegated to TEE. Tx: ${sig}`);
    return { sig, sessionPda };
  }
}
