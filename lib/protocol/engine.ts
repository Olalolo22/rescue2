// Rescue Protocol — Interactive Simulation & Protocol Engine
// Implements full lifecycle from ARCHITECTURE.md and Milestone 0 Probes

import { PROTOCOL_CONSTANTS } from './constants'
import { KNOWN_PDAS } from './pda'
import {
  MevInterceptLog,
  PositionTelemetry,
  ProtocolState,
  RescueRecordReceipt,
  SealedBid,
} from './types'

export const INITIAL_TELEMETRY: PositionTelemetry = {
  owner: PROTOCOL_CONSTANTS.BORROWER_PUBKEY,
  collateralMint: 'So11111111111111111111111111111111111111112',
  debtMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  collateralSol: PROTOCOL_CONSTANTS.COLLATERAL_SOL,
  collateralUsd: PROTOCOL_CONSTANTS.COLLATERAL_SOL * PROTOCOL_CONSTANTS.NORMAL_SOL_PRICE,
  debtUsd: PROTOCOL_CONSTANTS.DEBT_USDC,
  solPriceUsd: PROTOCOL_CONSTANTS.NORMAL_SOL_PRICE,
  healthFactor: 1.31,
  liquidationThresholdUsd: PROTOCOL_CONSTANTS.LIQUIDATION_THRESHOLD,
  state: 'HEALTHY',
  rescueCount: 1,
}

export const INITIAL_BIDS: SealedBid[] = [
  {
    id: 'bid-1',
    rescuerPubkey: '7xK9...m4Zq',
    slot: 284719412,
    encryptedHash: '0x4fa97c11b82e41...[TEE-ENCRYPTED]',
    penaltyBps: 400, // 4.00%
    bondSol: 1.0,
    timestamp: '12s ago',
    status: 'SEALED',
  },
  {
    id: 'bid-2',
    rescuerPubkey: '2mP4...8vLk',
    slot: 284719419,
    encryptedHash: '0x8b21ca584102ff...[TEE-ENCRYPTED]',
    penaltyBps: 250, // 2.50% - winning bid
    bondSol: 1.0,
    timestamp: '8s ago',
    status: 'SEALED',
  },
  {
    id: 'bid-3',
    rescuerPubkey: '9qL1...w3Nm',
    slot: 284719426,
    encryptedHash: '0x1c7e990b5a329d...[TEE-ENCRYPTED]',
    penaltyBps: 320, // 3.20%
    bondSol: 1.0,
    timestamp: '2s ago',
    status: 'SEALED',
  },
]

export const INITIAL_MEV_LOGS: MevInterceptLog[] = [
  {
    id: 'log-init',
    timestamp: '23:59:01',
    actor: 'Pyth Hermes',
    action: 'PriceUpdateV2 replicated on MagicBlock TEE ER',
    status: 'SYSTEM',
    details: 'SOL/USD: $100.00 · Latency: 12ms',
  },
  {
    id: 'log-mon',
    timestamp: '23:59:12',
    actor: 'Keeper Crank',
    action: 'Health Factor Telemetry Stream Active',
    status: 'SYSTEM',
    details: 'Position RP-0427 monitored. HF: 1.31 (HEALTHY)',
  },
]

/**
 * Generates client-fallback simulated MEV liquidation attack probe logs (Probe 03 & 06)
 */
export function generateMevAttackProbeLogs(): MevInterceptLog[] {
  const time = new Date().toTimeString().split(' ')[0]
  return [
    {
      id: `mev-detect-${Date.now()}`,
      timestamp: time,
      actor: 'MEV Searcher (Jito 8xA4..)',
      action: 'Detected underwater position on Solana L1',
      status: 'WARNING',
      details: 'HF 0.88 < 1.00. Attempting priority bundle liquidate()...',
    },
    {
      id: `mev-block-${Date.now()}`,
      timestamp: time,
      actor: 'Solana Runtime (L1)',
      action: 'TRANSACTION REJECTED — Error 3007',
      status: 'BLOCKED',
      details: 'AccountOwnedByWrongProgram: L1 mutation locked by MagicBlock DLP',
      errorSig: '0x1777_3007_AccountOwnedByWrongProgram',
    },
    {
      id: `mev-deflect-${Date.now()}`,
      timestamp: time,
      actor: 'Rescue Protocol',
      action: 'Invariant I6 Upheld: Front-run neutralized',
      status: 'SUCCESS',
      details: 'Private reverse auction continuing securely inside TEE enclave.',
    },
  ]
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
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend API Bridge Functions (Calls Next.js API routes with graceful fallback)
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveTelemetryResponse {
  success: boolean
  slot: number
  health: string
  latencyMs: number
  programId: string
  programDeployed: boolean
  teeValidator: string
  pythSolPriceUsd: number
  timestamp: string
  rpc: string
}

export async function fetchLiveTelemetryApi(): Promise<LiveTelemetryResponse | null> {
  try {
    const res = await fetch('/api/protocol/telemetry', { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export interface MevProbeResponse {
  success: boolean
  blocked: boolean
  errorReason: string
  errorSig: string
  attacker: string
  targetPosition: string
  slot: number
  latencyMs: number
  logs: MevInterceptLog[]
  invariantsConfirmed: string[]
}

export async function executeMevProbeApi(): Promise<MevProbeResponse | null> {
  try {
    const res = await fetch('/api/protocol/probe-mev', { method: 'POST' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export interface E2EResponse {
  success: boolean
  executionSlot: number
  latencyMs: number
  steps: {
    step: number
    title: string
    details: string
    slot: number
    timestamp: string
  }[]
  invariants: {
    id: string
    title: string
    status: string
  }[]
  settlement: {
    incidentId: string
    rescueRecordPda: string
    positionPda: string
    winningPenaltyBps: number
    publicPenaltyBps: number
    surplusSavedBps: number
    surplusSavedUsd: number
    equityRetainedUsd: number
  }
}

export async function executeE2ELifecycleApi(): Promise<E2EResponse | null> {
  try {
    const res = await fetch('/api/protocol/e2e', { method: 'POST' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export interface VerifySuiteResponse {
  success: boolean
  slot: number
  latencyMs: number
  probes: {
    id: string
    name: string
    target: string
    status: string
    result: string
  }[]
  invariantsCount: string
  receiptPda: string
  programId: string
  timestamp: string
}

export async function executeVerifySuiteApi(): Promise<VerifySuiteResponse | null> {
  try {
    const res = await fetch('/api/protocol/verify')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
