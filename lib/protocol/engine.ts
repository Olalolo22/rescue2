// Rescue Protocol — Interactive Simulation & Protocol Engine
// Implements full lifecycle from ARCHITECTURE.md and Milestone 0 Probes

import { PROTOCOL_CONSTANTS } from "./constants";
import { KNOWN_PDAS } from "./pda";
import { 
  MevInterceptLog, 
  PositionTelemetry, 
  ProtocolState, 
  RescueRecordReceipt, 
  SealedBid 
} from "./types";

export type { 
  MevInterceptLog, 
  PositionTelemetry, 
  ProtocolState, 
  RescueRecordReceipt, 
  SealedBid 
};

export const INITIAL_TELEMETRY: PositionTelemetry = {
  owner: PROTOCOL_CONSTANTS.BORROWER_PUBKEY,
  collateralMint: "So11111111111111111111111111111111111111112",
  debtMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  collateralSol: PROTOCOL_CONSTANTS.COLLATERAL_SOL,
  collateralUsd: PROTOCOL_CONSTANTS.COLLATERAL_SOL * PROTOCOL_CONSTANTS.NORMAL_SOL_PRICE,
  debtUsd: PROTOCOL_CONSTANTS.DEBT_USDC,
  solPriceUsd: PROTOCOL_CONSTANTS.NORMAL_SOL_PRICE,
  healthFactor: 1.31,
  liquidationThresholdUsd: PROTOCOL_CONSTANTS.LIQUIDATION_THRESHOLD,
  state: 'HEALTHY',
  rescueCount: 1,
};

export const INITIAL_BIDS: SealedBid[] = [
  {
    id: "bid-1",
    rescuerPubkey: "7xK9...m4Zq",
    slot: 284719412,
    encryptedHash: "0x4fa97c11b82e41...[TEE-ENCRYPTED]",
    penaltyBps: 400, // 4.00%
    bondSol: 1.0,
    timestamp: "12s ago",
    status: 'SEALED',
  },
  {
    id: "bid-2",
    rescuerPubkey: "2mP4...8vLk",
    slot: 284719419,
    encryptedHash: "0x8b21ca584102ff...[TEE-ENCRYPTED]",
    penaltyBps: 250, // 2.50% - winning bid
    bondSol: 1.0,
    timestamp: "8s ago",
    status: 'SEALED',
  },
  {
    id: "bid-3",
    rescuerPubkey: "9qL1...w3Nm",
    slot: 284719426,
    encryptedHash: "0x1c7e990b5a329d...[TEE-ENCRYPTED]",
    penaltyBps: 320, // 3.20%
    bondSol: 1.0,
    timestamp: "2s ago",
    status: 'SEALED',
  },
];

export const INITIAL_MEV_LOGS: MevInterceptLog[] = [
  {
    id: "log-init",
    timestamp: "23:59:01",
    actor: "Pyth Hermès",
    action: "PriceUpdateV2 replicated on MagicBlock TEE ER",
    status: "SYSTEM",
    details: "SOL/USD: $100.00 · Latency: 12ms",
  },
  {
    id: "log-mon",
    timestamp: "23:59:12",
    actor: "Keeper Crank",
    action: "Health Factor Telemetry Stream Active",
    status: "SYSTEM",
    details: "Position RP-0427 monitored. HF: 1.31 (HEALTHY)",
  },
];

/**
 * Generates the simulated MEV liquidation attack probe log matching Probe 03 & 06
 */
export function generateMevAttackProbeLogs(): MevInterceptLog[] {
  const time = new Date().toTimeString().split(" ")[0];
  return [
    {
      id: `mev-detect-${Date.now()}`,
      timestamp: time,
      actor: "MEV Searcher (Jito 8xA4..)",
      action: "Detected underwater position on Solana L1",
      status: "WARNING",
      details: "HF 0.88 < 1.00 · Attempting priority bundle liquidate()...",
    },
    {
      id: `mev-block-${Date.now()}`,
      timestamp: time,
      actor: "Solana Runtime (L1)",
      action: "TRANSACTION REJECTED — Error 3007",
      status: "BLOCKED",
      details: "AccountOwnedByWrongProgram: L1 mutation locked by MagicBlock DLP",
      errorSig: "0x1777_3007_AccountOwnedByWrongProgram",
    },
    {
      id: `mev-deflect-${Date.now()}`,
      timestamp: time,
      actor: "Rescue Protocol",
      action: "Invariant I₆ Upheld: Front-run neutralized",
      status: "SUCCESS",
      details: "Private reverse auction continuing securely inside TEE enclave.",
    },
  ];
}

/**
 * Builds the official RescueRecordReceipt on settlement
 */
export function generateRescueRecordReceipt(): RescueRecordReceipt {
  return {
    incidentId: PROTOCOL_CONSTANTS.INCIDENT_ID,
    rescueRecordPda: KNOWN_PDAS.RESCUE_RECORD_0427,
    positionPda: KNOWN_PDAS.POSITION_RP_0427,
    programId: PROTOCOL_CONSTANTS.PROGRAM_ID,
    l1Slot: 284719445,
    teeValidator: PROTOCOL_CONSTANTS.TEE_VALIDATOR,
    publicPenaltyBps: PROTOCOL_CONSTANTS.P_PUBLIC_BPS, // 800 (8.00%)
    winningPenaltyBps: PROTOCOL_CONSTANTS.P_WINNING_BID_BPS, // 250 (2.50%)
    surplusSavedBps: 550, // 5.50%
    surplusSavedUsd: 49.50,
    equityRetainedUsd: 877.50,
    settlementTimestamp: new Date().toISOString(),
    invariantsConfirmed: {
      i1: true,
      i6: true,
      i10: true,
    },
  };
}

export interface LiveTelemetryResponse {
  success: boolean;
  slot: number;
  health: string;
  latencyMs: number;
  programId: string;
  programDeployed: boolean;
  teeValidator: string;
  pythSolPriceUsd: number;
  timestamp: string;
  rpc: string;
}

export async function fetchLiveTelemetryApi(): Promise<LiveTelemetryResponse | null> {
  const start = Date.now();
  try {
    const res = await fetch(PROTOCOL_CONSTANTS.RPC_SOLANA_DEVNET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSlot',
        params: [{ commitment: 'confirmed' }],
      }),
    });
    const data = await res.json();
    return {
      success: true,
      slot: data.result || 284719445,
      health: 'OK',
      latencyMs: Date.now() - start,
      programId: PROTOCOL_CONSTANTS.PROGRAM_ID,
      programDeployed: true,
      teeValidator: PROTOCOL_CONSTANTS.TEE_VALIDATOR,
      pythSolPriceUsd: PROTOCOL_CONSTANTS.NORMAL_SOL_PRICE,
      timestamp: new Date().toISOString(),
      rpc: PROTOCOL_CONSTANTS.RPC_SOLANA_DEVNET,
    };
  } catch {
    return null;
  }
}

