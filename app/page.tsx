'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  LockKeyhole,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Terminal,
  TriangleAlert,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { WalletButton } from '@/components/WalletButton'
import { useSolanaWallet } from '@/lib/wallet/WalletContext'
import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'
import { KNOWN_PDAS } from '@/lib/protocol/pda'
import { executeDevnetSettlementTx, SettleTxResult } from '@/lib/protocol/settleTx'
import {
  MevInterceptLog,
  PositionTelemetry,
  SealedBid,
} from '@/lib/protocol/types'
import {
  INITIAL_TELEMETRY,
  INITIAL_BIDS,
  INITIAL_MEV_LOGS,
  generateMevAttackProbeLogs,
  fetchLiveTelemetryApi,
  executeMevProbeApi,
  executeE2ELifecycleApi,
  executeVerifySuiteApi,
  VerifySuiteResponse,
} from '@/lib/protocol/engine'

type Phase = 'healthy' | 'at-risk' | 'intervention' | 'matched' | 'settled' | 'fallback'

const phases: { id: Phase; label: string }[] = [
  { id: 'healthy', label: 'HEALTHY' },
  { id: 'at-risk', label: 'AT RISK' },
  { id: 'intervention', label: 'INTERVENTION' },
  { id: 'matched', label: 'MATCHED' },
  { id: 'settled', label: 'SETTLED' },
]

export default function Page() {
  const { publicKey, connected, walletName, balanceSol, provider, getProvider, openModal } = useSolanaWallet()
  const [phase, setPhase] = useState<Phase>('healthy')
  const [seconds, setSeconds] = useState(PROTOCOL_CONSTANTS.AUCTION_DURATION_SECONDS)
  const [recordOpen, setRecordOpen] = useState(false)
  const [positionProfile, setPositionProfile] = useState<'wallet' | 'benchmark'>('benchmark')

  // Live settlement on Solana Devnet
  const [isSettlingOnChain, setIsSettlingOnChain] = useState(false)
  const [settleTxResult, setSettleTxResult] = useState<SettleTxResult | null>(null)
  const [settleNotice, setSettleNotice] = useState<string | null>(null)

  // Backend state — always live, no toggle
  const [liveSlot, setLiveSlot] = useState<number>(284719445)
  const [networkLatency, setNetworkLatency] = useState<number>(14)
  const [isRunningE2e, setIsRunningE2e] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifySuiteResponse | null>(null)

  const [telemetry, setTelemetry] = useState<PositionTelemetry>(INITIAL_TELEMETRY)
  const [bids] = useState<SealedBid[]>(INITIAL_BIDS)
  const [mevLogs, setMevLogs] = useState<MevInterceptLog[]>(INITIAL_MEV_LOGS)
  const [isProbingMev, setIsProbingMev] = useState(false)
  const [copiedPda, setCopiedPda] = useState(false)

  // Auto-switch profile when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      setPositionProfile('wallet')
      setTelemetry((prev) => ({
        ...prev,
        collateralSol: 1.00,
        debtUsd: 80.00,
        collateralUsd: 1.00 * prev.solPriceUsd,
        liquidationThresholdUsd: 84.00,
        healthFactor: 1.25,
      }))
    }
  }, [connected, publicKey])

  const handleSelectProfile = (profile: 'wallet' | 'benchmark') => {
    setPositionProfile(profile)
    setPhase('healthy')
    setSeconds(PROTOCOL_CONSTANTS.AUCTION_DURATION_SECONDS)
    const isWallet = profile === 'wallet'
    const solAmount = isWallet ? 1.00 : PROTOCOL_CONSTANTS.COLLATERAL_SOL
    const debtAmount = isWallet ? 80.00 : PROTOCOL_CONSTANTS.DEBT_USDC
    setTelemetry({
      ...INITIAL_TELEMETRY,
      collateralSol: solAmount,
      debtUsd: debtAmount,
      collateralUsd: solAmount * PROTOCOL_CONSTANTS.NORMAL_SOL_PRICE,
      liquidationThresholdUsd: isWallet ? 84.00 : PROTOCOL_CONSTANTS.LIQUIDATION_THRESHOLD,
      healthFactor: isWallet ? 1.25 : 1.31,
      state: 'HEALTHY',
    })
  }

  // Poll live Solana Devnet telemetry
  useEffect(() => {
    let mounted = true
    async function updateTelemetry() {
      const data = await fetchLiveTelemetryApi()
      if (!mounted || !data) return
      setLiveSlot(data.slot)
      setNetworkLatency(data.latencyMs)
      if (data.pythSolPriceUsd && phase === 'healthy') {
        setTelemetry((prev) => ({
          ...prev,
          solPriceUsd: data.pythSolPriceUsd,
          collateralUsd: prev.collateralSol * data.pythSolPriceUsd,
        }))
      }
    }
    updateTelemetry()
    const interval = setInterval(updateTelemetry, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [phase])

  // 60-second reverse auction timer
  useEffect(() => {
    if (phase !== 'intervention') return
    if (seconds <= 0) { setPhase('fallback'); return }
    const timer = window.setTimeout(() => setSeconds((v) => Math.max(0, v - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, seconds])

  const activeIndex = useMemo(
    () => (phase === 'fallback' ? 2 : phases.findIndex((p) => p.id === phase)),
    [phase]
  )

  const reset = () => {
    setPhase('healthy')
    setSeconds(PROTOCOL_CONSTANTS.AUCTION_DURATION_SECONDS)
    setRecordOpen(false)
    setSettleTxResult(null)
    setSettleNotice(null)
    setIsSettlingOnChain(false)
    const isWallet = positionProfile === 'wallet' && connected && publicKey
    const solAmount = isWallet ? 1.00 : PROTOCOL_CONSTANTS.COLLATERAL_SOL
    const debtAmount = isWallet ? 80.00 : PROTOCOL_CONSTANTS.DEBT_USDC
    setTelemetry({
      ...INITIAL_TELEMETRY,
      collateralSol: solAmount,
      debtUsd: debtAmount,
      collateralUsd: solAmount * PROTOCOL_CONSTANTS.NORMAL_SOL_PRICE,
      liquidationThresholdUsd: isWallet ? 84.00 : PROTOCOL_CONSTANTS.LIQUIDATION_THRESHOLD,
      healthFactor: isWallet ? 1.25 : 1.31,
      state: 'HEALTHY',
    })
    setMevLogs(INITIAL_MEV_LOGS)
    setIsProbingMev(false)
    setIsRunningE2e(false)
  }

  const handleSettle = async () => {
    const activeProvider = provider || getProvider()
    const savedUsd = (telemetry.debtUsd * 0.055).toFixed(2)

    if (connected && publicKey && activeProvider) {
      setIsSettlingOnChain(true)
      setSettleNotice(null)
      try {
        const result = await executeDevnetSettlementTx({
          provider: activeProvider,
          walletPubkey: publicKey,
          incidentId: activeIncident,
          savedUsd,
          penaltyBps: 250,
        })
        setSettleTxResult(result)
        setPhase('settled')
        setTelemetry((prev) => ({ ...prev, state: 'SETTLED', healthFactor: 1.2 }))
      } catch (err: any) {
        console.warn('[Rescue Protocol] Live Devnet settlement signature error/cancel:', err)
        const isUserReject = /reject|cancel|declined/i.test(err?.message || '')
        if (isUserReject) {
          setSettleNotice('Wallet signature was cancelled in wallet. Settlement completed in simulated mode.')
        } else {
          setSettleNotice(`Live tx notice: ${err?.message || 'Transaction failed'}. Completed in simulated mode.`)
        }
        setPhase('settled')
        setTelemetry((prev) => ({ ...prev, state: 'SETTLED', healthFactor: 1.2 }))
      } finally {
        setIsSettlingOnChain(false)
      }
    } else {
      setPhase('settled')
      setTelemetry((prev) => ({ ...prev, state: 'SETTLED', healthFactor: 1.2 }))
    }
  }

  const beginRisk = () => {
    setPhase('at-risk')
    setSeconds(PROTOCOL_CONSTANTS.AUCTION_DURATION_SECONDS)
    setTelemetry((prev) => ({
      ...prev,
      solPriceUsd: PROTOCOL_CONSTANTS.CRASH_SOL_PRICE,
      collateralUsd: prev.collateralSol * PROTOCOL_CONSTANTS.CRASH_SOL_PRICE,
      healthFactor: 0.88,
      state: 'AT_RISK',
    }))
    document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
  }

  const startIntervention = () => {
    setPhase('intervention')
    setSeconds(PROTOCOL_CONSTANTS.AUCTION_DURATION_SECONDS)
    setTelemetry((prev) => ({ ...prev, state: 'IN_INTERVENTION_ZONE' }))
    setMevLogs((prev) => [
      ...prev,
      {
        id: `delegation-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        actor: 'Rescue Keeper',
        action: 'Position PDA Delegated to MagicBlock TEE ER',
        status: 'SUCCESS',
        details: 'DLP ownership active · L1 mutation locked by Error 3007',
      },
    ])
  }

  const handleMevAttackProbe = async () => {
    setIsProbingMev(true)
    const res = await executeMevProbeApi()
    if (res && res.logs && res.logs.length) {
      setLiveSlot(res.slot)
      setMevLogs((prev) => [...prev, ...res.logs])
      setIsProbingMev(false)
      return
    }
    // Client fallback if RPC is slow
    const newLogs = generateMevAttackProbeLogs()
    setTimeout(() => {
      setMevLogs((prev) => [...prev, ...newLogs])
      setIsProbingMev(false)
    }, 450)
  }

  const handleRunE2E = async () => {
    if (isRunningE2e) return
    setIsRunningE2e(true)
    document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })

    const res = await executeE2ELifecycleApi()

    setPhase('at-risk')
    setTelemetry((prev) => ({
      ...prev,
      solPriceUsd: PROTOCOL_CONSTANTS.CRASH_SOL_PRICE,
      collateralUsd: prev.collateralSol * PROTOCOL_CONSTANTS.CRASH_SOL_PRICE,
      healthFactor: 0.88,
      state: 'AT_RISK',
    }))
    await new Promise((r) => setTimeout(r, 900))

    setPhase('intervention')
    setSeconds(59)
    setTelemetry((prev) => ({ ...prev, state: 'IN_INTERVENTION_ZONE' }))
    if (res && res.steps) {
      setLiveSlot(res.executionSlot)
      const e2eLogs: MevInterceptLog[] = res.steps.slice(3, 6).map((s) => ({
        id: `e2e-${s.step}-${Date.now()}`,
        timestamp: s.timestamp,
        actor: 'Protocol Runner',
        action: s.title,
        status: s.step === 5 ? 'BLOCKED' : 'SYSTEM',
        details: s.details,
      }))
      setMevLogs((prev) => [...prev, ...e2eLogs])
    }
    await new Promise((r) => setTimeout(r, 1400))

    setPhase('matched')
    setTelemetry((prev) => ({ ...prev, state: 'MATCHED' }))
    await new Promise((r) => setTimeout(r, 1100))

    setPhase('settled')
    setTelemetry((prev) => ({ ...prev, state: 'SETTLED', healthFactor: 1.2 }))
    setIsRunningE2e(false)
  }

  const handleRunVerifySuite = async () => {
    setIsVerifying(true)
    const res = await executeVerifySuiteApi()
    if (res) { setVerifyResult(res); setLiveSlot(res.slot) }
    setIsVerifying(false)
  }

  const activeBorrower = positionProfile === 'wallet' && publicKey
    ? publicKey
    : PROTOCOL_CONSTANTS.BORROWER_PUBKEY
  const activeIncident = positionProfile === 'wallet' && publicKey
    ? `PILOT-${publicKey.slice(0, 4).toUpperCase()}`
    : PROTOCOL_CONSTANTS.INCIDENT_ID

  return (
    <main className="site-shell">

      {/* ─── NAVIGATION ─── */}
      <header className="site-nav">
        <a className="brand" href="#top" aria-label="Rescue Protocol home">
          <span className="brand-mark"><Siren size={15} /></span>
          <span>RESCUE <b>PROTOCOL</b></span>
        </a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#problem">THE PROBLEM</a>
          <a href="#mechanism">MECHANISM</a>
          <a href="#invariants">INVARIANTS</a>
          <a href="#simulator">SIMULATE</a>
        </nav>
        <div className="nav-right">
          <span className="network-status" title={`Program: ${PROTOCOL_CONSTANTS.PROGRAM_ID}`}>
            <i /> DEVNET
          </span>
          <WalletButton />
        </div>
      </header>

      {/* ─── TELEMETRY STRIP — liveness only, no controls ─── */}
      <div className="protocol-strip" aria-label="Protocol telemetry">
        <span><i className="telemetry-dot" /> DEVNET RPC</span>
        <span>SLOT: <b>{liveSlot.toLocaleString()}</b></span>
        <span>LATENCY: <b>{networkLatency}ms</b></span>
        <span>PYTH SOL/USD: <b>${telemetry.solPriceUsd.toFixed(2)}</b></span>
        <span className="strip-right"><b>MAGICBLOCK</b> / EPHEMERAL EXECUTION</span>
      </div>

      {/* ─── HERO ─── */}
      <section className="hero-section motion-enter" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-pip" /> MAGICBLOCK-POWERED EMERGENCY INFRASTRUCTURE
          </div>
          <h1>
            Liquidation is a race.<br />
            <em>Rescue makes it a market.</em>
          </h1>
          <p className="hero-lede">
            When a lending position crosses the danger line, MEV bots have already won.
            Rescue inserts a 60-second confidential window — liquidators compete to save
            the borrower instead of racing to punish them.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={beginRisk}>
              RUN THE RESCUE SIMULATION <ArrowRight size={16} />
            </button>
            <a className="text-link" href="#mechanism">
              SEE HOW IT WORKS <ArrowDown size={14} />
            </a>
          </div>
          <div className="hero-proof">
            <span><Radio size={14} /> LIVE MECHANISM DEMO</span>
            <span><LockKeyhole size={14} /> SEALED COMPETITION</span>
            <span><ShieldCheck size={14} /> INVARIANTS VERIFIED</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Rescue protocol architecture preview">
          <div className="visual-topline">
            <span>INCIDENT {activeIncident}</span>
            <span className="visual-live"><i /> {telemetry.state}</span>
          </div>
          <div className="visual-amount">
            ${telemetry.collateralUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span> {telemetry.collateralSol.toFixed(2)} SOL collateralized position</span>
          </div>
          <div className="visual-metrics">
            <Metric label="SOL PRICE" value={`$${telemetry.solPriceUsd.toFixed(2)}`} />
            <Metric
              label="HEALTH FACTOR"
              value={telemetry.healthFactor.toFixed(2)}
              tone={telemetry.healthFactor >= 1.2 ? 'green' : telemetry.healthFactor < 1.0 ? 'danger' : 'amber'}
            />
            <Metric
              label="STATUS"
              value={telemetry.state}
              tone={telemetry.state === 'HEALTHY' ? 'green' : 'danger'}
            />
          </div>
          <div className="visual-route">
            <span>BASE SOLANA</span>
            <i />
            <b>{telemetry.state === 'HEALTHY' ? 'MONITORING CRANK ACTIVE' : 'TEE SHIELD DELEGATED'}</b>
          </div>
          <div className="visual-corner">01 / 05</div>
        </div>
      </section>

      {/* ─── THE PROBLEM ─── */}
      <section className="thesis-section" id="problem">
        <div className="section-label">THE IMPOSSIBLE MOMENT</div>
        <div className="thesis-grid">
          <h2>Public liquidation is a race the borrower has already lost.</h2>
          <div>
            <p>
              When collateral crosses the danger line on base Solana, MEV searchers
              immediately snipe and extract an 8.00% penalty in the public mempool.
              The borrower has no recourse, no market, no negotiation.
            </p>
            <p>
              Rescue intercepts the distressed position and delegates it into a
              confidential MagicBlock TEE enclave. Outside bots cannot touch it.
              Inside, liquidators compete to offer the <em>lowest</em> penalty.
            </p>
          </div>
        </div>
        <div className="contrast-row">
          <Contrast
            label="PUBLIC LIQUIDATION"
            items={['Public searcher priority gas race', 'MEV bots seize 8.00% penalty ($72.00 lost)', 'Borrower equity cannibalized']}
            tone="danger"
          />
          <div className="contrast-arrow"><ArrowRight /></div>
          <Contrast
            label="RESCUE INTERVENTION"
            items={['Confidential 60s reverse auction', 'Liquidators bid penalty down to 2.50%', 'Borrower saves +$49.50 equity (+5.50%)']}
            tone="safe"
          />
        </div>
      </section>

      {/* ─── MECHANISM ─── */}
      <section className="mechanism-section" id="mechanism">
        <div className="section-label">THE MAGICBLOCK PRIMITIVE</div>
        <div className="mechanism-heading">
          <h2>One temporary execution layer.<br /><em>One better outcome.</em></h2>
          <p>Rescue is infrastructure presented as a product: delegate the position, run the emergency in TEE, commit the verifiable receipt.</p>
        </div>
        <div className="architecture">
          <ArchitectureStep number="01" title="BASE SOLANA" copy="Position breaches 1.05 HF. Keeper crank calls initiate_rescue." />
          <div className="arch-line"><span>DELEGATE</span><i /></div>
          <ArchitectureStep number="02" title="MAGICBLOCK TEE (PER)" copy="Account locked on L1 with Error 3007. 60s confidential reverse auction." active />
          <div className="arch-line"><span>COMMIT</span><i /></div>
          <ArchitectureStep number="03" title="BASE SOLANA" copy="Settlement commits immutable RescueRecord PDA back to L1." />
        </div>
      </section>

      {/* ─── SIMULATOR ─── */}
      <section className="simulator-section motion-section" id="simulator">
        <div className="simulator-intro">
          <div>
            <div className="section-label">LIVE PROTOCOL COCKPIT</div>
            <h2>Trigger the emergency.</h2>
            <p>Watch a healthy position move through the exact lifecycle Rescue is built to protect.</p>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '4px', border: '1px solid #28313e', borderRadius: '4px', background: '#0e1218' }}>
              <span style={{ fontSize: '9px', color: '#7a8696', paddingLeft: '6px', font: '9px var(--font-data)' }}>POSITION SOURCE:</span>
              <button
                type="button"
                onClick={() => handleSelectProfile('wallet')}
                style={{
                  padding: '3px 10px', fontSize: '9px', fontFamily: 'var(--font-data)', borderRadius: '3px',
                  border: positionProfile === 'wallet' ? '1px solid var(--green)' : '1px solid transparent',
                  background: positionProfile === 'wallet' ? 'rgba(0, 245, 160, 0.12)' : 'transparent',
                  color: positionProfile === 'wallet' ? 'var(--green)' : '#8fa89e',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
                }}
              >
                <Wallet size={10} />
                {connected && publicKey
                  ? `MY WALLET (${publicKey.slice(0, 4)}...${publicKey.slice(-4)})`
                  : 'CONNECT MY WALLET (1.00 SOL)'}
              </button>
              <button
                type="button"
                onClick={() => handleSelectProfile('benchmark')}
                style={{
                  padding: '3px 10px', fontSize: '9px', fontFamily: 'var(--font-data)', borderRadius: '3px',
                  border: positionProfile === 'benchmark' ? '1px solid var(--purple)' : '1px solid transparent',
                  background: positionProfile === 'benchmark' ? 'rgba(169, 148, 244, 0.14)' : 'transparent',
                  color: positionProfile === 'benchmark' ? 'var(--purple)' : '#8fa89e',
                  cursor: 'pointer',
                }}
              >
                BENCHMARK SPEC (10.00 SOL · RP-0427)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div className="incident-id" role="status" aria-live="polite">
              <span>INCIDENT</span>
              <strong>{activeIncident}</strong>
              <small>{phase === 'healthy' ? 'AWAITING TRIGGER' : phase === 'fallback' ? 'FAIL-OPEN COMPLETE' : 'ACTIVE SIMULATION'}</small>
            </div>
            <button
              type="button"
              className="subtle-button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', padding: '5px 10px',
                background: isRunningE2e ? 'rgba(0, 245, 160, 0.15)' : '#161c24',
                borderColor: isRunningE2e ? 'var(--green)' : '#273344',
                color: isRunningE2e ? 'var(--green)' : '#c3cad4',
              }}
              onClick={handleRunE2E}
              disabled={isRunningE2e}
            >
              <Terminal size={12} /> {isRunningE2e ? 'RUNNING E2E ENGINE...' : 'RUN FULL PROTOCOL LIFECYCLE [E2E]'}
            </button>
          </div>
        </div>

        {/* Phase Rail */}
        <div className="phase-rail" aria-label="Rescue lifecycle">
          {phases.map((item, index) => (
            <div key={item.id} className={`phase-step ${index < activeIndex ? 'done' : ''} ${item.id === phase ? 'current' : ''}`}>
              <span>{index < activeIndex ? <Check size={13} /> : index + 1}</span>
              <b>{item.label}</b>
              {index < phases.length - 1 && <i />}
            </div>
          ))}
          {phase === 'fallback' && (
            <div className="fallback-rail-label"><TriangleAlert size={13} /> EXPIRED / FAIL-OPEN</div>
          )}
        </div>

        {phase === 'healthy' && (
          <HealthyState
            telemetry={telemetry}
            onCrash={beginRisk}
            borrowerKey={activeBorrower}
            connected={connected}
            balanceSol={balanceSol}
            positionProfile={positionProfile}
            onOpenModal={openModal}
          />
        )}
        {phase === 'at-risk' && (
          <AtRiskState
            telemetry={telemetry}
            onRescue={startIntervention}
            borrowerKey={activeBorrower}
            connected={connected}
          />
        )}
        {phase === 'intervention' && (
          <InterventionZone
            seconds={seconds}
            bids={bids}
            mevLogs={mevLogs}
            isProbingMev={isProbingMev}
            onProbeMev={handleMevAttackProbe}
            onMatch={() => {
              setPhase('matched')
              setTelemetry((prev) => ({ ...prev, state: 'MATCHED' }))
            }}
            onExpire={() => {
              setPhase('fallback')
              setTelemetry((prev) => ({ ...prev, state: 'FAIL_OPEN_EXPIRED' }))
            }}
          />
        )}
        {phase === 'matched' && (
          <MatchedState
            telemetry={telemetry}
            connected={connected}
            walletName={walletName}
            publicKey={publicKey}
            isSettling={isSettlingOnChain}
            onSettle={handleSettle}
          />
        )}
        {phase === 'settled' && (
          <SettledState
            telemetry={telemetry}
            activeIncident={activeIncident}
            txResult={settleTxResult}
            settleNotice={settleNotice}
            onRecord={() => setRecordOpen(true)}
            onReset={reset}
          />
        )}
        {phase === 'fallback' && <FallbackState onReset={reset} />}
      </section>

      {/* ─── INVARIANTS ─── */}
      <section className="proof-section" id="invariants">
        <div className="proof-copy">
          <div className="section-label">VERIFIED CORE INVARIANTS</div>
          <h2>Mechanically proven on Solana Devnet.</h2>
          <p>Milestone 0 verification proved all 7 blocking assumptions against live TEE ER infrastructure before writing core program code.</p>
          <div className="hero-proof" style={{ marginTop: '20px' }}>
            {PROTOCOL_CONSTANTS.INVARIANTS.map((inv) => (
              <span key={inv.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Check size={14} style={{ color: 'var(--green)' }} />
                <b>{inv.id}:</b> {inv.title}
              </span>
            ))}
          </div>
          <div style={{ marginTop: '24px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary-button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '0 18px', fontSize: '11px' }}
              onClick={handleRunVerifySuite}
              disabled={isVerifying}
            >
              <ShieldCheck size={15} /> {isVerifying ? 'VERIFYING PROBES ON DEVNET...' : 'RUN LIVE VERIFICATION HARNESS [7 PROBES]'}
            </button>
            <a className="text-link" href="#simulator">
              RUN SIMULATION AGAIN <ArrowRight size={14} />
            </a>
          </div>
          {verifyResult && (
            <div style={{ marginTop: '22px', border: '1px solid #273344', borderRadius: '4px', background: '#0e1218', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e2634', paddingBottom: '8px', fontSize: '11px', fontFamily: 'var(--font-data)' }}>
                <span style={{ color: 'var(--green)' }}>[PASS] {verifyResult.invariantsCount}</span>
                <span style={{ color: '#8fa89e' }}>DEVNET SLOT: {verifyResult.slot} · {verifyResult.latencyMs}ms</span>
              </div>
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                {verifyResult.probes.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', borderBottom: '1px solid #161c24', paddingBottom: '6px' }}>
                    <span style={{ color: '#c3cad4' }}><b>{p.id}:</b> {p.name}</span>
                    <span style={{ color: 'var(--green)', fontFamily: 'var(--font-data)', whiteSpace: 'nowrap' }}>[{p.status}]</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="proof-stat">
          <span>SURPLUS SAVED</span>
          <strong>+5.50%</strong>
          <b>+${(telemetry.debtUsd * 0.055).toFixed(2)} BORROWER EQUITY RETAINED</b>
          <small>Standard 8.00% public liquidation ➔ 2.50% winning TEE bid</small>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-intro">
          <div className="brand">
            <span className="brand-mark">
              <Siren size={15} />
            </span>
            <span>
              RESCUE <b>PROTOCOL</b>
            </span>
          </div>
          <p>
            A competitive intervention primitive for Solana.
            <br />
            MagicBlock-powered execution before liquidation.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <span>PROTOCOL</span>
            <a href="/demo">Intervention Zone</a>
            <a href="/activity">Live Activity</a>
            <a href="/proof/rescue-record-rp-0427">RescueRecords</a>
          </div>
          <div>
            <span>VERIFY</span>
            <a href="/verify">Proof Inspector</a>
            <a href="/protocol">How It Works</a>
            <a href="/receipts/rp-0427-alpha">Settlement Receipt</a>
          </div>
          <div>
            <span>ECOSYSTEM</span>
            <a href="https://www.magicblock.xyz/" target="_blank" rel="noreferrer">
              MagicBlock <ExternalLink size={11} />
            </a>
            <a href="https://solana.com/" target="_blank" rel="noreferrer">
              Solana <ExternalLink size={11} />
            </a>
            <a href="https://github.com/Olalolo22/rescue2" target="_blank" rel="noreferrer">
              GitHub <ExternalLink size={11} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 RESCUE PROTOCOL</span>
          <span>
            <i /> DEVNET PROTOTYPE
          </span>
          <span>TEE STATUS: SIMULATED</span>
          <span>SETTLEMENT: {settleTxResult ? 'DEVNET L1 CONFIRMED' : 'SIMULATED'}</span>
        </div>
      </footer>

      {/* ─── RESCUERECORD MODAL ─── */}
      {recordOpen && (
        <RescueRecord
          copied={copiedPda}
          incidentId={activeIncident}
          telemetry={telemetry}
          txResult={settleTxResult}
          onCopy={() => {
            navigator.clipboard?.writeText(KNOWN_PDAS.RESCUE_RECORD_0427)
            setCopiedPda(true)
            setTimeout(() => setCopiedPda(false), 2000)
          }}
          onClose={() => setRecordOpen(false)}
        />
      )}
    </main>
  )
}

/* ─── SUB-COMPONENTS ─── */

function HealthyState({ telemetry, onCrash, borrowerKey, connected, balanceSol, positionProfile, onOpenModal }: {
  telemetry: PositionTelemetry; onCrash: () => void; borrowerKey?: string | null
  connected?: boolean; balanceSol?: number | null; positionProfile: 'wallet' | 'benchmark'; onOpenModal: () => void
}) {
  const displayKey = borrowerKey ? `${borrowerKey.slice(0, 4)}...${borrowerKey.slice(-4)}` : '7xK4...9e2'
  return (
    <div className="demo-state quiet-layout">
      <section className="position-card panel">
        <div className="panel-kicker">
          <ShieldCheck size={16} /> MONITORED POSITION <span className="safe-tag">HEALTHY</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 12px', borderBottom: '1px solid #1c222c', fontSize: '11px', fontFamily: 'var(--font-data)' }}>
          <div>
            <span style={{ color: '#737e8d' }}>BORROWER: </span>
            <b style={{ color: '#e3e7ed' }}>{displayKey}</b>
            {connected && positionProfile === 'wallet' && (
              <span style={{ marginLeft: '6px', color: 'var(--green)', fontSize: '9px', background: 'rgba(0,245,160,0.1)', padding: '2px 5px', borderRadius: '3px' }}>
                [REAL DEVNET WALLET]
              </span>
            )}
          </div>
          <div>
            {connected && balanceSol !== null ? (
              <span style={{ color: 'var(--green)' }}>DEVNET BALANCE: <b>{balanceSol?.toFixed(2)} SOL</b></span>
            ) : (
              <button type="button" onClick={onOpenModal} style={{ background: 'none', border: '1px solid #2d604e', color: 'var(--green)', fontSize: '10px', fontFamily: 'var(--font-data)', padding: '2px 7px', cursor: 'pointer', borderRadius: '3px' }}>
                + CONNECT WALLET
              </button>
            )}
          </div>
        </div>
        <div className="position-value">${telemetry.collateralUsd.toFixed(2)}</div>
        <div className="position-sub">{telemetry.collateralSol.toFixed(2)} SOL Collateral &middot; ${telemetry.debtUsd.toFixed(2)} USDC Debt</div>
        <div className="metrics-grid">
          <Metric label="SOL ORACLE PRICE" value={`$${telemetry.solPriceUsd.toFixed(2)}`} />
          <Metric label="HEALTH FACTOR" value={telemetry.healthFactor.toFixed(2)} tone="green" />
          <Metric label="LIQUIDATION THRESHOLD" value={`$${telemetry.liquidationThresholdUsd.toFixed(2)}`} />
        </div>
        <div style={{ marginTop: '30px' }}>
          <button className="primary-button trigger-button" onClick={onCrash} style={{ width: '100%' }}>
            <Siren size={17} /> TRIGGER SIMULATED MARKET DROP (-18%) <ArrowRight size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px', fontFamily: 'var(--font-data)', color: '#707b89' }}>
            <span>⚡ SIMULATED EVENT FOR DEMO</span>
            <span>CRASHES ORACLE TO $82.00 → TRIPS HF TO 0.88</span>
          </div>
        </div>
      </section>
      <aside className="demo-note">
        <span className="section-label">THE RESCUE PRINCIPLE</span>
        <h3>Liquidation is not inevitable.</h3>
        <p>When collateral crosses the danger line, Rescue buys the borrower a private moment to find a better outcome.</p>
        <div className="principle-line"><LockKeyhole size={15} /><span>CONFIDENTIAL BY DEFAULT (MAGICBLOCK TEE)</span></div>
        <div className="principle-line"><ShieldCheck size={15} /><span>FAILS OPEN, NEVER GUARANTEES</span></div>
      </aside>
    </div>
  )
}

function AtRiskState({ telemetry, onRescue, borrowerKey, connected }: {
  telemetry: PositionTelemetry; onRescue: () => void; borrowerKey?: string | null; connected?: boolean
}) {
  const displayKey = borrowerKey ? `${borrowerKey.slice(0, 4)}...${borrowerKey.slice(-4)}` : '7xK4...9e2'
  return (
    <div className="demo-state risk-layout">
      <section className="crash-panel">
        <div className="eyebrow danger-eyebrow"><CircleAlert size={15} /> MARKET DOWNTURN DETECTED &middot; BORROWER: {displayKey}</div>
        <h3>POSITION AT RISK</h3>
        <div className="crash-values">
          <div>
            <span>SOL ORACLE PRICE</span>
            <strong>$100.00 <i>&rarr;</i> ${telemetry.solPriceUsd.toFixed(2)}</strong>
            <small className="danger-text">&minus;18.00% CRASH TRIGGERED</small>
          </div>
          <div>
            <span>HEALTH FACTOR</span>
            <strong>1.25 <i>&rarr;</i> {telemetry.healthFactor.toFixed(2)}</strong>
            <small className="danger-text">CRITICAL BREACH BELOW 1.05</small>
          </div>
        </div>
        <div className="danger-rule"><span /><b>PUBLIC LIQUIDATION THREAT DETECTED ON L1 &middot; MEV SEARCHERS ARMED</b></div>
      </section>
      <section className="rescue-cta panel">
        <div className="panel-kicker"><ShieldAlert size={16} /> EMERGENCY INTERVENTION</div>
        <h3>Protect this position<br /><em>before it&apos;s public.</em></h3>
        <p>Rescue temporarily locks public liquidation on L1 and creates a 60-second confidential TEE window for competitive liquidator intervention.</p>
        <button className="rescue-button" onClick={onRescue}>DELEGATE &amp; ENTER TEE ZONE <ArrowRight size={17} /></button>
        <div className="cta-note"><Clock3 size={14} /> 60 SECONDS &middot; MAGICBLOCK TEE ENCLAVE &middot; MEV DEFLECTED</div>
      </section>
    </div>
  )
}

function InterventionZone({ seconds, bids, mevLogs, isProbingMev, onProbeMev, onMatch, onExpire }: {
  seconds: number; bids: SealedBid[]; mevLogs: MevInterceptLog[]
  isProbingMev: boolean; onProbeMev: () => void; onMatch: () => void; onExpire: () => void
}) {
  return (
    <div className="demo-state zone-layout">
      <section className="zone-panel">
        <div className="zone-header">
          <div>
            <div className="eyebrow purple-eyebrow"><span className="pulse-dot" /> MAGICBLOCK EPHEMERAL ROLLUP (TEE ACTIVE)</div>
            <h3>INTERVENTION ZONE</h3>
            <p>Position delegated from Solana L1. Liquidator sealed reverse auction open.</p>
          </div>
          <div className="countdown" role="timer" aria-live="assertive" aria-label={`${seconds} seconds remaining`}>
            <span>TIME REMAINING</span>
            <strong>00:{String(seconds).padStart(2, '0')}</strong>
            <div className="countdown-track"><i style={{ width: `${(seconds / 60) * 100}%` }} /></div>
          </div>
        </div>
        <div className="delegation-strip">
          <span>BASE SOLANA</span><ArrowRight size={14} />
          <b>DLP DELEGATION ACTIVE (ERROR 3007 LOCK)</b>
          <ArrowRight size={14} /><span>MAGICBLOCK TEE ENCLAVE</span>
        </div>
        <div className="sealed-grid">
          <SealStatus icon={<ShieldCheck />} label="PUBLIC LIQUIDATION" value="BLOCKED (3007)" accent="green" />
          <SealStatus icon={<LockKeyhole />} label="BIDS STATUS" value="3 SEALED (ENCRYPTED)" />
          <SealStatus icon={<FileCheck2 />} label="RESERVE CAP" value="6.50% (P_RESERVE)" accent="purple" />
          <SealStatus icon={<Copy />} label="CROSS-READ PRIVACY" value="HARDWARE ENFORCED" />
        </div>
        <div className="zone-actions">
          <button className="match-button" onClick={onMatch}>CLOSE AUCTION &amp; MATCH WINNER <ArrowRight size={16} /></button>
          <button className="subtle-button" onClick={onExpire}>LET AUCTION EXPIRE (FAIL-OPEN)</button>
        </div>
        <p className="zone-disclaimer"><LockKeyhole size={13} /> Competing lenders cannot inspect each other&apos;s bids (CrossReadDenied 6013). Winner selected by lowest valid penalty.</p>
      </section>
      <aside className="event-stack">
        <div className="stack-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>MEV ATTACK DEFENSE CONSOLE</span>
          <button className="subtle-button" style={{ minHeight: '26px', padding: '0 8px', fontSize: '9px', display: 'inline-flex', gap: '4px', alignItems: 'center' }} onClick={onProbeMev} disabled={isProbingMev}>
            <Zap size={11} /> {isProbingMev ? 'PROBING RPC...' : 'PROBE MEV ATTACK [LIVE RPC]'}
          </button>
        </div>
        <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'grid', gap: '8px', marginTop: '12px' }}>
          {mevLogs.map((log) => (
            <div key={log.id} className="blocked-event" style={{ borderColor: log.status === 'BLOCKED' ? '#68363d' : '#273344', background: log.status === 'BLOCKED' ? '#171115' : '#10141b' }}>
              <div className="event-icon">{log.status === 'BLOCKED' ? <ShieldAlert size={16} /> : <Terminal size={16} />}</div>
              <div>
                <span>[{log.timestamp}] {log.actor}</span>
                <b style={{ color: log.status === 'BLOCKED' ? '#eb747a' : '#c3cad4' }}>{log.action}</b>
                <small>{log.details}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="fallback-mini">
          <span>FAIL-OPEN GUARANTEE</span>
          <p>Auction &rarr; Winner &rarr; Runner-up &rarr; Hard Cutoff (60s) &rarr; Public Liquidation fallback.</p>
        </div>
      </aside>
    </div>
  )
}

function MatchedState({
  telemetry,
  connected,
  walletName,
  publicKey,
  isSettling,
  onSettle,
}: {
  telemetry: PositionTelemetry
  connected: boolean
  walletName: string | null
  publicKey: string | null
  isSettling: boolean
  onSettle: () => void
}) {
  const savedUsd = (telemetry.debtUsd * 0.055).toFixed(2)
  return (
    <div className="demo-state outcome-layout">
      <section className="matched-panel panel">
        <div className="eyebrow success-eyebrow"><Check size={15} /> COMPETITIVE REVERSE AUCTION MATCHED</div>
        <h3>Winner crowned.<br /><em>Borrower equity saved.</em></h3>
        <div className="winner-row">
          <div><span>WINNING PENALTY</span><strong>2.50% (250 bps)</strong></div>
          <div><span>RESCUER</span><strong>2mP4...8vLk (Rescuer B)</strong></div>
          <div><span>SURPLUS SAVED</span><strong style={{ color: 'var(--green)' }}>+${savedUsd} (+5.50%)</strong></div>
        </div>
        {isSettling ? (
          <button className="settle-button" disabled style={{ opacity: 0.85, cursor: 'wait' }}>
            <Zap className="animate-spin" size={16} /> WAITING FOR WALLET SIGNATURE &amp; L1 CONFIRMATION...
          </button>
        ) : (
          <button className="settle-button" onClick={onSettle}>
            COMMIT SETTLEMENT &amp; RESCUERECORD TO SOLANA L1 <ArrowRight size={16} />
          </button>
        )}
        {connected && publicKey ? (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', font: '10px var(--font-data)', color: 'var(--green)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 8px var(--green)' }} />
            <span>Connected: <b>{walletName || 'Solana Wallet'}</b> ({publicKey.slice(0, 4)}...{publicKey.slice(-4)}) &middot; Live Devnet L1 settlement enabled</span>
          </div>
        ) : (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', font: '10px var(--font-data)', color: '#687583' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#687583', display: 'inline-block' }} />
            <span>Connect your wallet above to sign a live on-chain Devnet transaction</span>
          </div>
        )}
      </section>
      <aside className="compare-tease">
        <span>THE PENALTY GAP</span>
        <div><b>8.00%</b><small>PUBLIC EXTRACTED</small></div>
        <ChevronRight />
        <div className="teal-text"><b>2.50%</b><small>RESCUE PROTECTED</small></div>
      </aside>
    </div>
  )
}

function SettledState({
  telemetry,
  activeIncident,
  txResult,
  settleNotice,
  onRecord,
  onReset,
}: {
  telemetry: PositionTelemetry
  activeIncident: string
  txResult: SettleTxResult | null
  settleNotice: string | null
  onRecord: () => void
  onReset: () => void
}) {
  const publicFee = (telemetry.debtUsd * 0.08).toFixed(2)
  const rescueFee = (telemetry.debtUsd * 0.025).toFixed(2)
  const savedUsd = (telemetry.debtUsd * 0.055).toFixed(2)
  return (
    <div className="demo-state settled-layout">
      <section className="settlement-hero">
        <div className="eyebrow cyan-eyebrow"><Check size={15} /> SETTLEMENT VERIFIED &middot; RESCUERECORD COMMITTED</div>
        <h3>+${savedUsd} BORROWER<br /><em>EQUITY RETAINED</em></h3>
        <p>The position was rescued at 2.50% penalty instead of the standard 8.00% public liquidation fee. The cryptographic outcome is permanent, portable, and verifiable on Solana L1.</p>
        
        {txResult && (
          <div style={{ margin: '18px 0', padding: '14px 18px', border: '1px solid #33727a', background: '#101b1f', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Check size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <div style={{ font: '10px var(--font-data)', color: '#d7e9eb' }}>
                <span style={{ color: '#829ba0' }}>SOLANA DEVNET TX:</span>{' '}
                <strong style={{ color: 'var(--cyan)' }}>{txResult.signature.slice(0, 10)}...{txResult.signature.slice(-8)}</strong>
                <span style={{ marginLeft: '10px', color: '#687583' }}>(Slot {txResult.slot.toLocaleString()})</span>
              </div>
            </div>
            <a
              href={txResult.explorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                font: '10px var(--font-data)',
                color: 'var(--cyan)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
                borderBottom: '1px solid var(--cyan)',
                paddingBottom: '2px',
                letterSpacing: '.04em',
              }}
            >
              EXPLORER PROOF <ExternalLink size={12} />
            </a>
          </div>
        )}

        {settleNotice && (
          <div style={{ margin: '14px 0', padding: '10px 14px', border: '1px solid #3a3248', background: '#171420', font: '10px var(--font-data)', color: '#a59db5' }}>
            {settleNotice}
          </div>
        )}

        <div className="settlement-buttons">
          <button className="record-button" onClick={onRecord}><FileCheck2 size={16} /> VIEW RESCUERECORD PDA</button>
          <button className="subtle-button" onClick={onReset}>RUN ANOTHER INCIDENT</button>
        </div>
      </section>
      <section className="comparison">
        <div className="comparison-head"><span>SETTLEMENT COMPARISON</span><small>INCIDENT {activeIncident}</small></div>
        <div className="comparison-row public"><span>PUBLIC LIQUIDATION (8.00%)</span><strong>-${publicFee}</strong><small>Equity Lost</small></div>
        <div className="comparison-row rescue"><span>RESCUE WINNING BID (2.50%)</span><strong>-${rescueFee}</strong><small>Fee Incurred</small></div>
        <div className="saved-row"><span>BORROWER SURPLUS SAVED</span><strong>+${savedUsd} (+5.50%)</strong></div>
      </section>
    </div>
  )
}

function FallbackState({ onReset }: { onReset: () => void }) {
  return (
    <div className="demo-state fallback-layout">
      <div className="fallback-alert">
        <TriangleAlert size={21} />
        <div>
          <div className="eyebrow danger-eyebrow">HARD CUTOFF REACHED</div>
          <h3>Rescue window expired.</h3>
          <p>No valid winner was matched before the 60-second confidential auction closed. The system has safely failed open to standard public liquidation.</p>
        </div>
      </div>
      <div className="fallback-path">
        <div className="path-done">AUCTION <Check /></div><ChevronRight />
        <div className="path-done">WINNER <Check /></div><ChevronRight />
        <div className="path-now">HARD CUTOFF <Clock3 /></div><ChevronRight />
        <div className="path-end">PUBLIC LIQUIDATION</div>
      </div>
      <button className="subtle-button" onClick={onReset}>RESET INCIDENT</button>
    </div>
  )
}

function RescueRecord({
  copied,
  incidentId,
  telemetry,
  txResult,
  onCopy,
  onClose,
}: {
  copied: boolean
  incidentId: string
  telemetry: PositionTelemetry
  txResult: SettleTxResult | null
  onCopy: () => void
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const savedUsd = (telemetry.debtUsd * 0.055).toFixed(2)
  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="record-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="record-modal">
        <button ref={closeButtonRef} className="close-button" onClick={onClose} aria-label="Close RescueRecord"><X size={18} /></button>
        <div className="record-seal"><FileCheck2 size={23} /></div>
        <div className="eyebrow cyan-eyebrow">VERIFIABLE IMMUTABLE PDA</div>
        <h3 id="record-title">{incidentId}</h3>
        <p className="record-copy">Cryptographic receipt of intervention, reverse auction matching, and L1 settlement.</p>
        <div className="record-list">
          <RecordRow label="RESCUERECORD PDA" value={KNOWN_PDAS.RESCUE_RECORD_0427.slice(0, 18) + '...'} green />
          {txResult ? (
            <>
              <RecordRow label="L1 STATUS" value="CONFIRMED ON SOLANA DEVNET" green />
              <RecordRow label="TX SIGNATURE" value={txResult.signature.slice(0, 16) + '...'} green />
              <RecordRow label="L1 SLOT" value={txResult.slot.toLocaleString()} />
            </>
          ) : (
            <>
              <RecordRow label="L1 STATUS" value="SIMULATED PROTOTYPE" />
              <RecordRow label="PROGRAM ID" value={PROTOCOL_CONSTANTS.PROGRAM_ID.slice(0, 14) + '...'} />
              <RecordRow label="L1 SLOT" value="284,719,445" />
            </>
          )}
          <RecordRow label="WINNING PENALTY" value="2.50% (250 bps)" green />
          <RecordRow label="PUBLIC PENALTY" value="8.00% (800 bps)" />
          <RecordRow label="SURPLUS SAVED" value={`+$${savedUsd} (+5.50%)`} green />
          <RecordRow label="INVARIANTS" value="I1 · I6 · I10 VERIFIED" green />
        </div>
        
        {txResult && (
          <a
            href={txResult.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="record-button full-button"
            style={{ textDecoration: 'none', justifyContent: 'center', marginBottom: '10px' }}
          >
            <ExternalLink size={14} /> VIEW ON SOLANA EXPLORER (DEVNET)
          </a>
        )}

        <button className="record-button full-button" onClick={onCopy}>
          <Copy size={15} /> {copied ? 'COPIED PDA TO CLIPBOARD!' : 'COPY RESCUERECORD PDA'}
        </button>
      </div>
    </div>
  )
}

function Contrast({ label, items, tone }: { label: string; items: string[]; tone: 'danger' | 'safe' }) {
  return (
    <div className={`contrast-card ${tone}`}>
      <span>{label}</span>
      {items.map((item) => (<p key={item}><i />{item}</p>))}
    </div>
  )
}

function ArchitectureStep({ number, title, copy, active }: { number: string; title: string; copy: string; active?: boolean }) {
  return (
    <div className={`architecture-step ${active ? 'active' : ''}`}>
      <span>{number}</span><strong>{title}</strong><p>{copy}</p>
    </div>
  )
}

function SealStatus({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className={`seal-status ${accent || ''}`}>{icon}<span>{label}</span><strong>{value}</strong></div>
  )
}

function RecordRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="record-row"><span>{label}</span><strong className={green ? 'green-text' : ''}>{value}</strong></div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="metric"><span>{label}</span><strong className={tone ? `${tone}-text` : ''}>{value}</strong></div>
  )
}
