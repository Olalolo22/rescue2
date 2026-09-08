// Rescue Protocol — Type Definitions & State Model
// Matches on-chain Anchor program GCcUbgthDu323rfq9Z3iWNFR632wXWMZ66KKtdTtxDBT

export type ProtocolState = 
  | 'HEALTHY'
  | 'AT_RISK'
  | 'IN_INTERVENTION_ZONE'
  | 'MATCHED'
  | 'SETTLED'
  | 'FAIL_OPEN_EXPIRED';

export interface PositionTelemetry {
  owner: string;
  collateralMint: string;
  debtMint: string;
  collateralSol: number;
  collateralUsd: number;
  debtUsd: number;
  solPriceUsd: number;
  healthFactor: number;
  liquidationThresholdUsd: number;
  state: ProtocolState;
  rescueCount: number;
}

export interface SealedBid {
  id: string;
  rescuerPubkey: string;
  slot: number;
  encryptedHash: string;
  penaltyBps: number; // revealed only after matching
  bondSol: number;
  timestamp: string;
  status: 'SEALED' | 'EVALUATED' | 'WINNER' | 'RUNNER_UP';
}

export interface MevInterceptLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  status: 'BLOCKED' | 'SYSTEM' | 'SUCCESS' | 'WARNING';
  details: string;
  errorSig?: string;
}

export interface ProtocolConfig {
  pPublicBps: number;       // 800 (8.00%)
  pReserveCapBps: number;   // 650 (6.50% max permissible penalty)
  minBorrowerSavingBps: number; // 150 (1.50% guaranteed savings)
  targetHfBps: number;      // 12000 (1.20)
  auctionDurationSec: number; // 60s
  slashingBondBps: number;  // 200 (2.00%)
}

export interface RescueRecordReceipt {
  incidentId: string;
  rescueRecordPda: string;
  positionPda: string;
  programId: string;
  l1Slot: number;
  teeValidator: string;
  publicPenaltyBps: number;
  winningPenaltyBps: number;
  surplusSavedBps: number;
  surplusSavedUsd: number;
  equityRetainedUsd: number;
  settlementTimestamp: string;
  invariantsConfirmed: {
    i1: boolean; // No public liquidation permitted during intervention
    i6: boolean; // L1 mutation rejected with Error 3007 while delegated
    i10: boolean; // Verifiable immutable on-chain RescueRecord PDA
  };
}
