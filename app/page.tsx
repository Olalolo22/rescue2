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
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Terminal,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'

import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'
import { KNOWN_PDAS } from '@/lib/protocol/pda'
import { 
  MevInterceptLog, 
  PositionTelemetry, 
  ProtocolState, 
  SealedBid 
} from '@/lib/protocol/types'
import { 
  INITIAL_TELEMETRY, 
  INITIAL_BIDS, 
  INITIAL_MEV_LOGS, 
  generateMevAttackProbeLogs, 
  generateRescueRecordReceipt 
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
  const [phase, setPhase] = useState<Phase>('healthy')
  const [seconds, setSeconds] = useState(PROTOCOL_CONSTANTS.AUCTION_DURATION_SECONDS)
  const [recordOpen, setRecordOpen] = useState(false)
  
  // Reactive telemetry state
  const [telemetry, setTelemetry] = useState<PositionTelemetry>(INITIAL_TELEMETRY)
  const [bids, setBids] = useState<SealedBid[]>(INITIAL_BIDS)
  const [mevLogs, setMevLogs] = useState<MevInterceptLog[]>(INITIAL_MEV_LOGS)
  const [isProbingMev, setIsProbingMev] = useState(false)
  const [copiedPda, setCopiedPda] = useState(false)

  // 60-second reverse auction timer
  useEffect(() => {
    if (phase !== 'intervention') return
    if (seconds <= 0) {
      setPhase('fallback')
      return
    }
    const timer = window.setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, seconds])

  const activeIndex = useMemo(
    () => (phase === 'fallback' ? 2 : phases.findIndex((item) => item.id === phase)),
    [phase]
  )

  const reset = () => {
    setPhase('healthy')
    setSeconds(PROTOCOL_CONSTANTS.AUCTION_DURATION_SECONDS)
    setRecordOpen(false)
    setTelemetry(INITIAL_TELEMETRY)
    setMevLogs(INITIAL_MEV_LOGS)
    setIsProbingMev(false)
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
    // Add delegation log
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

  const handleMevAttackProbe = () => {
    setIsProbingMev(true)
    const newLogs = generateMevAttackProbeLogs()
    setTimeout(() => {
      setMevLogs((prev) => [...prev, ...newLogs])
      setIsProbingMev(false)
    }, 600)
  }

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
          <a className="nav-cta" href="#simulator">
            RUN SIMULATION <ArrowRight size={14} />
          </a>
        </div>
      </header>

      {/* ─── LIVE TELEMETRY STRIP ─── */}
      <div className="protocol-strip" aria-label="Protocol telemetry">
        <span><i className="telemetry-dot" /> LIVE NETWORK</span>
        <span>PROGRAM: <b>{PROTOCOL_CONSTANTS.PROGRAM_ID.slice(0, 8)}...{PROTOCOL_CONSTANTS.PROGRAM_ID.slice(-6)}</b></span>
        <span>MAGICBLOCK TEE: <b>ACTIVE</b></span>
        <span>PYTH SOL/USD: <b>${telemetry.solPriceUsd.toFixed(2)}</b></span>
        <span className="strip-right">LATENCY <b>14ms</b> · HF: <b>{telemetry.healthFactor.toFixed(2)}</b></span>
      </div>

      {/* ─── HERO SECTION ─── */}
      <section className="hero-section motion-enter" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-pip" /> MAGICBLOCK-POWERED EMERGENCY INFRASTRUCTURE
          </div>
          <h1>
            Liquidation protection for the moment <em>before</em> liquidation.
          </h1>
          <p className="hero-lede">
            Rescue inserts a 60-second confidential TEE shield where liquidators compete in a reverse auction to offer the borrower the lowest penalty—deflecting MEV front-runners with Error 3007.
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
            <span>INCIDENT {PROTOCOL_CONSTANTS.INCIDENT_ID}</span>
            <span className="visual-live"><i /> {telemetry.state}</span>
          </div>
          <div className="visual-amount">
            ${telemetry.collateralUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span> {telemetry.collateralSol} SOL collateralized position</span>
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
              When collateral crosses the danger line on base Solana, MEV searchers immediately snipe and extract an 8.00% penalty in the public mempool.
            </p>
            <p>
              Rescue intercepts the distressed position and delegates it into a confidential MagicBlock TEE enclave. Outside bots cannot touch it.
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

      {/* ─── SIMULATOR SECTION ─── */}
      <section className="simulator-section motion-section" id="simulator">
        <div className="simulator-intro">
          <div>
            <div className="section-label">LIVE PROTOCOL COCKPIT</div>
            <h2>Trigger the emergency.</h2>
            <p>Watch a healthy position move through the exact lifecycle Rescue is built to protect.</p>
          </div>
          <div className="incident-id" role="status" aria-live="polite">
            <span>INCIDENT</span>
            <strong>{PROTOCOL_CONSTANTS.INCIDENT_ID}</strong>
            <small>{phase === 'healthy' ? 'AWAITING TRIGGER' : phase === 'fallback' ? 'FAIL-OPEN COMPLETE' : 'ACTIVE SIMULATION'}</small>
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

        {/* State Views */}
        {phase === 'healthy' && <HealthyState telemetry={telemetry} onCrash={beginRisk} />}
        {phase === 'at-risk' && <AtRiskState telemetry={telemetry} onRescue={startIntervention} />}
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
            onSettle={() => {
              setPhase('settled')
              setTelemetry((prev) => ({ ...prev, state: 'SETTLED', healthFactor: 1.20 }))
            }} 
          />
        )}
        {phase === 'settled' && (
          <SettledState onRecord={() => setRecordOpen(true)} onReset={reset} />
        )}
        {phase === 'fallback' && <FallbackState onReset={reset} />}
      </section>

      {/* ─── INVARIANTS SCORECARD ─── */}
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
          <a className="text-link" href="#simulator" style={{ marginTop: '24px' }}>
            RUN SIMULATION AGAIN <ArrowRight size={14} />
          </a>
        </div>
        <div className="proof-stat">
          <span>SURPLUS SAVED</span>
          <strong>+5.50%</strong>
          <b>+$49.50 BORROWER EQUITY RETAINED</b>
          <small>Standard 8.00% public liquidation ➔ 2.50% winning TEE bid</small>
        </div>
      </section>

      {/* ─── INSTITUTIONAL FOOTER ─── */}
      <footer className="site-footer">
        <div className="brand">
          <span className="brand-mark"><Siren size={15} /></span>
          <span>RESCUE <b>PROTOCOL</b></span>
        </div>
        <p>A MagicBlock-powered confidential pre-liquidation intervention primitive for Solana.</p>
        <div>
          <a href="https://github.com/Olalolo22/rescue" target="_blank" rel="noreferrer">
            GITHUB <ExternalLink size={13} />
          </a>
          <button onClick={reset}>RESET DEMO</button>
        </div>
      </footer>

      {/* ─── RESCUERECORD PDA MODAL ─── */}
      {recordOpen && (
        <RescueRecord 
          copied={copiedPda}
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

/* ─────────────────────────────────────────────────────────────────────────────
   State Sub-Components
   ───────────────────────────────────────────────────────────────────────────── */

function HealthyState({ telemetry, onCrash }: { telemetry: PositionTelemetry; onCrash: () => void }) {
  return (
    <div className="demo-state quiet-layout">
      <section className="position-card panel">
        <div className="panel-kicker">
          <ShieldCheck size={16} /> MONITORED POSITION <span className="safe-tag">HEALTHY</span>
        </div>
        <div className="position-value">${telemetry.collateralUsd.toFixed(2)}</div>
        <div className="position-sub">{telemetry.collateralSol} SOL collateralized debt position</div>
        <div className="metrics-grid">
          <Metric label="SOL PRICE" value={`$${telemetry.solPriceUsd.toFixed(2)}`} />
          <Metric label="HEALTH FACTOR" value={telemetry.healthFactor.toFixed(2)} tone="green" />
          <Metric label="LIQUIDATION THRESHOLD" value={`$${telemetry.liquidationThresholdUsd.toFixed(2)}`} />
        </div>
        <button className="primary-button trigger-button" onClick={onCrash}>
          <Siren size={17} /> SIMULATE MARKET DROP (-18%) <ArrowRight size={16} />
        </button>
        <p className="fine-print">Simulates sudden market downturn to trip the position into the AT_RISK zone.</p>
      </section>

      <aside className="demo-note">
        <span className="section-label">THE RESCUE PRINCIPLE</span>
        <h3>Liquidation is not inevitable.</h3>
        <p>When collateral crosses the danger line, Rescue buys the borrower a private moment to find a better outcome.</p>
        <div className="principle-line">
          <LockKeyhole size={15} />
          <span>CONFIDENTIAL BY DEFAULT (TEE)</span>
        </div>
        <div className="principle-line">
          <ShieldCheck size={15} />
          <span>FAILS OPEN, NEVER GUARANTEES</span>
        </div>
      </aside>
    </div>
  )
}

function AtRiskState({ telemetry, onRescue }: { telemetry: PositionTelemetry; onRescue: () => void }) {
  return (
    <div className="demo-state risk-layout">
      <section className="crash-panel">
        <div className="eyebrow danger-eyebrow">
          <CircleAlert size={15} /> MARKET DOWNTURN DETECTED
        </div>
        <h3>POSITION AT RISK</h3>
        <div className="crash-values">
          <div>
            <span>SOL PRICE</span>
            <strong>$100.00 <i>→</i> ${telemetry.solPriceUsd.toFixed(2)}</strong>
            <small className="danger-text">−18.00% CRASH</small>
          </div>
          <div>
            <span>HEALTH FACTOR</span>
            <strong>1.31 <i>→</i> {telemetry.healthFactor.toFixed(2)}</strong>
            <small className="danger-text">BELOW 1.05 THRESHOLD</small>
          </div>
        </div>
        <div className="danger-rule">
          <span />
          <b>PUBLIC LIQUIDATION THREAT DETECTED ON L1</b>
        </div>
      </section>

      <section className="rescue-cta panel">
        <div className="panel-kicker">
          <ShieldAlert size={16} /> EMERGENCY INTERVENTION
        </div>
        <h3>Protect this position<br /><em>before it&apos;s public.</em></h3>
        <p>
          Rescue temporarily freezes public liquidation on L1 and creates a 60-second confidential TEE window for competitive intervention.
        </p>
        <button className="rescue-button" onClick={onRescue}>
          ENTER INTERVENTION ZONE <ArrowRight size={17} />
        </button>
        <div className="cta-note">
          <Clock3 size={14} /> 60 SECONDS · BOND REQUIRED · MEV DEFLECTED
        </div>
      </section>
    </div>
  )
}

function InterventionZone({
  seconds,
  bids,
  mevLogs,
  isProbingMev,
  onProbeMev,
  onMatch,
  onExpire,
}: {
  seconds: number
  bids: SealedBid[]
  mevLogs: MevInterceptLog[]
  isProbingMev: boolean
  onProbeMev: () => void
  onMatch: () => void
  onExpire: () => void
}) {
  return (
    <div className="demo-state zone-layout">
      <section className="zone-panel">
        <div className="zone-header">
          <div>
            <div className="eyebrow purple-eyebrow">
              <span className="pulse-dot" /> MAGICBLOCK EPHEMERAL ROLLUP (TEE ACTIVE)
            </div>
            <h3>INTERVENTION ZONE</h3>
            <p>Position delegated from Solana L1. Liquidator sealed reverse auction open.</p>
          </div>
          <div className="countdown" role="timer" aria-live="assertive" aria-label={`${seconds} seconds remaining`}>
            <span>TIME REMAINING</span>
            <strong>00:{String(seconds).padStart(2, '0')}</strong>
            <div className="countdown-track">
              <i style={{ width: `${(seconds / 60) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="delegation-strip">
          <span>BASE SOLANA</span>
          <ArrowRight size={14} />
          <b>DLP DELEGATION ACTIVE (ERROR 3007 LOCK)</b>
          <ArrowRight size={14} />
          <span>MAGICBLOCK TEE ENCLAVE</span>
        </div>

        {/* Sealed Bids Grid */}
        <div className="sealed-grid">
          <SealStatus icon={<ShieldCheck />} label="PUBLIC LIQUIDATION" value="BLOCKED (3007)" accent="green" />
          <SealStatus icon={<LockKeyhole />} label="BIDS STATUS" value="3 SEALED (ENCRYPTED)" />
          <SealStatus icon={<FileCheck2 />} label="RESERVE CAP" value="6.50% (P_RESERVE)" accent="purple" />
          <SealStatus icon={<Copy />} label="CROSS-READ PRIVACY" value="HARDWARE ENFORCED" />
        </div>

        <div className="zone-actions">
          <button className="match-button" onClick={onMatch}>
            CLOSE AUCTION &amp; MATCH WINNER <ArrowRight size={16} />
          </button>
          <button className="subtle-button" onClick={onExpire}>
            LET AUCTION EXPIRE (FAIL-OPEN)
          </button>
        </div>

        <p className="zone-disclaimer">
          <LockKeyhole size={13} /> Competing lenders cannot inspect each other&apos;s bids (CrossReadDenied 6013). Winner selected by lowest valid penalty.
        </p>
      </section>

      {/* ─── REAL-TIME MEV ATTACK INTERCEPTOR TERMINAL ─── */}
      <aside className="event-stack">
        <div className="stack-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>MEV ATTACK DEFENSE CONSOLE</span>
          <button 
            className="subtle-button" 
            style={{ minHeight: '26px', padding: '0 8px', fontSize: '9px', display: 'inline-flex', gap: '4px', alignItems: 'center' }} 
            onClick={onProbeMev}
            disabled={isProbingMev}
          >
            <Zap size={11} /> {isProbingMev ? 'PROBING...' : 'PROBE MEV ATTACK'}
          </button>
        </div>

        <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'grid', gap: '8px', marginTop: '12px' }}>
          {mevLogs.map((log) => (
            <div key={log.id} className="blocked-event" style={{ borderColor: log.status === 'BLOCKED' ? '#68363d' : '#273344', background: log.status === 'BLOCKED' ? '#171115' : '#10141b' }}>
              <div className="event-icon">
                {log.status === 'BLOCKED' ? <ShieldAlert size={16} /> : <Terminal size={16} />}
              </div>
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
          <p>Auction ➔ Winner ➔ Runner-up ➔ Hard Cutoff (60s) ➔ Public Liquidation fallback.</p>
        </div>
      </aside>
    </div>
  )
}

function MatchedState({ onSettle }: { onSettle: () => void }) {
  return (
    <div className="demo-state outcome-layout">
      <section className="matched-panel panel">
        <div className="eyebrow success-eyebrow">
          <Check size={15} /> COMPETITIVE REVERSE AUCTION MATCHED
        </div>
        <h3>
          Winner crowned.<br />
          <em>Borrower equity saved.</em>
        </h3>
        <div className="winner-row">
          <div>
            <span>WINNING PENALTY</span>
            <strong>2.50% (250 bps)</strong>
          </div>
          <div>
            <span>RESCUER</span>
            <strong>2mP4...8vLk (Rescuer B)</strong>
          </div>
          <div>
            <span>SURPLUS SAVED</span>
            <strong style={{ color: 'var(--green)' }}>+$49.50 (+5.50%)</strong>
          </div>
        </div>
        <button className="settle-button" onClick={onSettle}>
          COMMIT SETTLEMENT &amp; RESCUERECORD TO SOLANA L1 <ArrowRight size={16} />
        </button>
      </section>

      <aside className="compare-tease">
        <span>THE PENALTY GAP</span>
        <div>
          <b>8.00%</b>
          <small>PUBLIC EXTRACTED</small>
        </div>
        <ChevronRight />
        <div className="teal-text">
          <b>2.50%</b>
          <small>RESCUE PROTECTED</small>
        </div>
      </aside>
    </div>
  )
}

function SettledState({ onRecord, onReset }: { onRecord: () => void; onReset: () => void }) {
  return (
    <div className="demo-state settled-layout">
      <section className="settlement-hero">
        <div className="eyebrow cyan-eyebrow">
          <Check size={15} /> SETTLEMENT VERIFIED · RESCUERECORD COMMITTED
        </div>
        <h3>
          +$49.50 BORROWER<br />
          <em>EQUITY RETAINED</em>
        </h3>
        <p>
          The position was rescued at 2.50% penalty instead of the standard 8.00% public liquidation fee. The cryptographic outcome is permanent, portable, and verifiable.
        </p>
        <div className="settlement-buttons">
          <button className="record-button" onClick={onRecord}>
            <FileCheck2 size={16} /> VIEW RESCUERECORD PDA
          </button>
          <button className="subtle-button" onClick={onReset}>
            RUN ANOTHER INCIDENT
          </button>
        </div>
      </section>

      <section className="comparison">
        <div className="comparison-head">
          <span>SETTLEMENT COMPARISON</span>
          <small>INCIDENT {PROTOCOL_CONSTANTS.INCIDENT_ID}</small>
        </div>
        <div className="comparison-row public">
          <span>PUBLIC LIQUIDATION (8.00%)</span>
          <strong>-$72.00</strong>
          <small>Equity Lost</small>
        </div>
        <div className="comparison-row rescue">
          <span>RESCUE WINNING BID (2.50%)</span>
          <strong>-$22.50</strong>
          <small>Fee Incurred</small>
        </div>
        <div className="saved-row">
          <span>BORROWER SURPLUS SAVED</span>
          <strong>+$49.50 (+5.50%)</strong>
        </div>
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
          <p>
            No valid winner was matched before the 60-second confidential auction closed. The system has safely failed open to standard public liquidation.
          </p>
        </div>
      </div>
      <div className="fallback-path">
        <div className="path-done">AUCTION <Check /></div>
        <ChevronRight />
        <div className="path-done">WINNER <Check /></div>
        <ChevronRight />
        <div className="path-now">HARD CUTOFF <Clock3 /></div>
        <ChevronRight />
        <div className="path-end">PUBLIC LIQUIDATION</div>
      </div>
      <button className="subtle-button" onClick={onReset}>
        RESET INCIDENT
      </button>
    </div>
  )
}

function RescueRecord({ copied, onCopy, onClose }: { copied: boolean; onCopy: () => void; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div 
      className="modal-backdrop" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="record-title" 
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="record-modal">
        <button ref={closeButtonRef} className="close-button" onClick={onClose} aria-label="Close RescueRecord">
          <X size={18} />
        </button>
        <div className="record-seal">
          <FileCheck2 size={23} />
        </div>
        <div className="eyebrow cyan-eyebrow">VERIFIABLE IMMUTABLE PDA</div>
        <h3 id="record-title">{PROTOCOL_CONSTANTS.INCIDENT_ID}</h3>
        <p className="record-copy">
          Cryptographic receipt of intervention, reverse auction matching, and L1 settlement.
        </p>
        <div className="record-list">
          <RecordRow label="RESCUERECORD PDA" value={KNOWN_PDAS.RESCUE_RECORD_0427.slice(0, 18) + '...'} green />
          <RecordRow label="PROGRAM ID" value={PROTOCOL_CONSTANTS.PROGRAM_ID.slice(0, 14) + '...'} />
          <RecordRow label="L1 SLOT" value="284,719,445" />
          <RecordRow label="WINNING PENALTY" value="2.50% (250 bps)" green />
          <RecordRow label="PUBLIC PENALTY" value="8.00% (800 bps)" />
          <RecordRow label="SURPLUS SAVED" value="+$49.50 (+5.50%)" green />
          <RecordRow label="INVARIANTS" value="I₁ · I₆ · I₁₀ VERIFIED" green />
        </div>
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
      {items.map((item) => (
        <p key={item}><i />{item}</p>
      ))}
    </div>
  )
}

function ArchitectureStep({ number, title, copy, active }: { number: string; title: string; copy: string; active?: boolean }) {
  return (
    <div className={`architecture-step ${active ? 'active' : ''}`}>
      <span>{number}</span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  )
}

function SealStatus({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className={`seal-status ${accent || ''}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RecordRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="record-row">
      <span>{label}</span>
      <strong className={green ? 'green-text' : ''}>{value}</strong>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone ? `${tone}-text` : ''}>{value}</strong>
    </div>
  )
}
