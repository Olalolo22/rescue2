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
  TriangleAlert,
  X,
} from 'lucide-react'

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
  const [seconds, setSeconds] = useState(60)
  const [recordOpen, setRecordOpen] = useState(false)

  useEffect(() => {
    if (phase !== 'intervention') return
    if (seconds <= 0) {
      setPhase('fallback')
      return
    }
    const timer = window.setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, seconds])

  const activeIndex = useMemo(() => phase === 'fallback' ? 2 : phases.findIndex((item) => item.id === phase), [phase])
  const reset = () => { setPhase('healthy'); setSeconds(60); setRecordOpen(false) }
  const beginRisk = () => { setPhase('at-risk'); setSeconds(60); document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' }) }

  return (
    <main className="site-shell">
      <header className="site-nav">
        <a className="brand" href="#top" aria-label="Rescue Protocol home"><span className="brand-mark"><Siren size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></a>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#problem">THE PROBLEM</a><a href="#mechanism">MECHANISM</a><a href="#simulator">SIMULATE</a>
        </nav>
        <div className="nav-right"><span className="network-status"><i /> DEVNET</span><a className="nav-cta" href="#simulator">RUN SIMULATION <ArrowRight size={14} /></a></div>
      </header>

      <section className="hero-section motion-enter" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-pip" /> MAGICBLOCK-POWERED EMERGENCY INFRASTRUCTURE</div>
          <h1>Liquidation protection for the moment <em>before</em> liquidation.</h1>
          <p className="hero-lede">Rescue moves an unsafe position into a fast, confidential intervention window—then commits the best outcome back to Solana.</p>
          <div className="hero-actions"><button className="primary-button" onClick={beginRisk}>RUN THE RESCUE SIMULATION <ArrowRight size={16} /></button><a className="text-link" href="#mechanism">SEE HOW IT WORKS <ArrowDown size={14} /></a></div>
          <div className="hero-proof"><span><Radio size={14} /> LIVE MECHANISM DEMO</span><span><LockKeyhole size={14} /> SEALED COMPETITION</span><span><ShieldCheck size={14} /> FAILS OPEN</span></div>
        </div>
        <div className="hero-visual" aria-label="Rescue protocol architecture preview">
          <div className="visual-topline"><span>POSITION RP-0427-ALPHA</span><span className="visual-live"><i /> MONITORED</span></div>
          <div className="visual-amount">$12,480<span> collateralized debt position</span></div>
          <div className="visual-metrics"><Metric label="SOL PRICE" value="$100.00" /><Metric label="HEALTH FACTOR" value="1.31" /><Metric label="STATUS" value="SAFE" tone="green" /></div>
          <div className="visual-route"><span>BASE SOLANA</span><i /><b>WAITING FOR INCIDENT</b></div>
          <div className="visual-corner">01 / 05</div>
        </div>
      </section>

      <section className="thesis-section" id="problem">
        <div className="section-label">THE IMPOSSIBLE MOMENT</div>
        <div className="thesis-grid"><h2>Public liquidation is a race the borrower has already lost.</h2><div><p>When collateral crosses the danger line, normal Solana gives the market one public outcome: liquidate fast, compete in the open, destroy value.</p><p>Rescue creates a private moment between risk and liquidation—long enough for a better intervention to exist.</p></div></div>
        <div className="contrast-row"><Contrast label="PUBLIC LIQUIDATION" items={['Public keeper race', 'Competitors read the same state', '8.00% borrower penalty']} tone="danger" /><div className="contrast-arrow"><ArrowRight /></div><Contrast label="RESCUE INTERVENTION" items={['Confidential rescue window', 'Bids remain sealed', 'Competitive 2.50% outcome']} tone="safe" /></div>
      </section>

      <section className="mechanism-section" id="mechanism">
        <div className="section-label">THE MAGICBLOCK PRIMITIVE</div>
        <div className="mechanism-heading"><h2>One temporary execution layer.<br /><em>One better outcome.</em></h2><p>Rescue is infrastructure presented as a product: delegate the position, run the emergency at high frequency, commit the result.</p></div>
        <div className="architecture"><ArchitectureStep number="01" title="BASE SOLANA" copy="Position crosses its liquidation threshold." /><div className="arch-line"><span>DELEGATE</span><i /></div><ArchitectureStep number="02" title="EPHEMERAL ROLLUP" copy="MagicBlock enables fast, confidential auction state." active /><div className="arch-line"><span>COMMIT</span><i /></div><ArchitectureStep number="03" title="BASE SOLANA" copy="Settlement and RescueRecord become verifiable." /></div>
      </section>

      <section className="simulator-section motion-section" id="simulator">
        <div className="simulator-intro"><div><div className="section-label">LIVE PROTOCOL DEMO</div><h2>Trigger the emergency.</h2><p>Watch a healthy position move through the exact lifecycle Rescue is built to protect.</p></div><div className="incident-id" role="status" aria-live="polite"><span>INCIDENT</span><strong>RP-0427-ALPHA</strong><small>{phase === 'healthy' ? 'AWAITING TRIGGER' : phase === 'fallback' ? 'FAIL-OPEN COMPLETE' : 'ACTIVE SIMULATION'}</small></div></div>
        <div className="phase-rail" aria-label="Rescue lifecycle">{phases.map((item, index) => <div key={item.id} className={`phase-step ${index < activeIndex ? 'done' : ''} ${item.id === phase ? 'current' : ''}`}><span>{index < activeIndex ? <Check size={13} /> : index + 1}</span><b>{item.label}</b>{index < phases.length - 1 && <i />}</div>)}{phase === 'fallback' && <div className="fallback-rail-label"><TriangleAlert size={13} /> EXPIRED / FAIL-OPEN</div>}</div>
        {phase === 'healthy' && <HealthyState onCrash={beginRisk} />}
        {phase === 'at-risk' && <AtRiskState onRescue={() => { setPhase('intervention'); setSeconds(60) }} />}
        {phase === 'intervention' && <InterventionZone seconds={seconds} onMatch={() => setPhase('matched')} onExpire={() => setPhase('fallback')} />}
        {phase === 'matched' && <MatchedState onSettle={() => setPhase('settled')} />}
        {phase === 'settled' && <SettledState onRecord={() => setRecordOpen(true)} onReset={reset} />}
        {phase === 'fallback' && <FallbackState onReset={reset} />}
      </section>

      <section className="proof-section"><div className="proof-copy"><div className="section-label">WHY IT MATTERS</div><h2>The technical win is the borrower outcome.</h2><p>MagicBlock makes a high-speed, sealed rescue auction possible. The result is simple enough to remember: less value extracted, more value returned.</p><a className="text-link" href="#simulator">RUN THE INCIDENT AGAIN <ArrowRight size={14} /></a></div><div className="proof-stat"><span>RESCUE OUTCOME</span><strong>50%</strong><b>BORROWER SURPLUS SAVED</b><small>8.00% public liquidation → 2.50% rescue</small></div></section>

      <footer className="site-footer"><div className="brand"><span className="brand-mark"><Siren size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></div><p>A MagicBlock-powered liquidation intervention primitive for Solana.</p><div><a href="#mechanism">TECHNICAL FLOW <ExternalLink size={13} /></a><button onClick={reset}>RESET DEMO</button></div></footer>
      {recordOpen && <RescueRecord onClose={() => setRecordOpen(false)} />}
    </main>
  )
}

function HealthyState({ onCrash }: { onCrash: () => void }) { return <div className="demo-state quiet-layout"><section className="position-card panel"><div className="panel-kicker"><ShieldCheck size={16} /> MONITORED POSITION <span className="safe-tag">SAFE</span></div><div className="position-value">$12,480.00</div><div className="position-sub">SOL collateralized debt position</div><div className="metrics-grid"><Metric label="SOL PRICE" value="$100.00" /><Metric label="HEALTH FACTOR" value="1.31" /><Metric label="LIQUIDATION THRESHOLD" value="$86.00" /></div><button className="primary-button trigger-button" onClick={onCrash}><Siren size={17} /> SIMULATE MARKET DROP <ArrowRight size={16} /></button><p className="fine-print">Trigger a controlled market event to observe the emergency response.</p></section><aside className="demo-note"><span className="section-label">THE RESCUE PRINCIPLE</span><h3>Liquidation is not inevitable.</h3><p>When collateral crosses the danger line, Rescue buys the borrower a private moment to find a better outcome.</p><div className="principle-line"><LockKeyhole size={15} /><span>CONFIDENTIAL BY DEFAULT</span></div><div className="principle-line"><ShieldCheck size={15} /><span>FAILS OPEN, NEVER GUARANTEES</span></div></aside></div> }

function AtRiskState({ onRescue }: { onRescue: () => void }) { return <div className="demo-state risk-layout"><section className="crash-panel"><div className="eyebrow danger-eyebrow"><CircleAlert size={15} /> MARKET EVENT DETECTED</div><h3>POSITION AT RISK</h3><div className="crash-values"><div><span>SOL PRICE</span><strong>$100 <i>→</i> $82</strong><small className="danger-text">−18.00%</small></div><div><span>HEALTH FACTOR</span><strong>1.31 <i>→</i> 0.88</strong><small className="danger-text">BELOW THRESHOLD</small></div></div><div className="danger-rule"><span /><b>PUBLIC LIQUIDATION ELIGIBLE</b></div></section><section className="rescue-cta panel"><div className="panel-kicker"><ShieldAlert size={16} /> EMERGENCY RESPONSE</div><h3>Protect this position<br /><em>before it&apos;s public.</em></h3><p>Rescue temporarily blocks public liquidation and creates a 60-second confidential window for competitive intervention.</p><button className="rescue-button" onClick={onRescue}>ENTER INTERVENTION ZONE <ArrowRight size={17} /></button><div className="cta-note"><Clock3 size={14} /> 60 SECONDS · BOND REQUIRED · FAILS OPEN</div></section></div> }

function InterventionZone({ seconds, onMatch, onExpire }: { seconds: number; onMatch: () => void; onExpire: () => void }) { return <div className="demo-state zone-layout"><section className="zone-panel"><div className="zone-header"><div><div className="eyebrow purple-eyebrow"><span className="pulse-dot" /> MAGICBLOCK EPHEMERAL ROLLUP ACTIVE</div><h3>INTERVENTION ZONE</h3><p>Position delegated from Solana. Competitive rescue window is open.</p></div><div className="countdown" role="timer" aria-live="assertive" aria-label={`${seconds} seconds remaining`}><span>TIME REMAINING</span><strong>00:{String(seconds).padStart(2, '0')}</strong><div className="countdown-track"><i style={{ width: `${(seconds / 60) * 100}%` }} /></div></div></div><div className="delegation-strip"><span>BASE SOLANA</span><ArrowRight size={14} /><b>POSITION DELEGATED</b><ArrowRight size={14} /><span>EPHEMERAL ROLLUP</span></div><div className="sealed-grid"><SealStatus icon={<ShieldCheck />} label="PUBLIC LIQUIDATION" value="BLOCKED" accent="green" /><SealStatus icon={<LockKeyhole />} label="BID STATUS" value="SEALED" /><SealStatus icon={<FileCheck2 />} label="LIQUIDATORS" value="3 CONNECTED" /><SealStatus icon={<Copy />} label="COMPETITOR VISIBILITY" value="CANNOT READ" /></div><div className="zone-actions"><button className="match-button" onClick={onMatch}>CLOSE AUCTION &amp; MATCH WINNER <ArrowRight size={16} /></button><button className="subtle-button" onClick={onExpire}>LET AUCTION EXPIRE</button></div><p className="zone-disclaimer"><LockKeyhole size={13} /> No bid values are visible while the auction is open. Winner is selected by the lowest valid penalty.</p></section><aside className="event-stack"><div className="stack-label">PROTOCOL ACTIVITY</div><div className="blocked-event"><div className="event-icon"><ShieldAlert size={18} /></div><div><span>LIQUIDATION ATTEMPT BLOCKED</span><b>Error 3007 — AccountOwnedByWrongProgram</b><small>PUBLIC KEEPER · 00:42 AGO</small></div></div><div className="fallback-mini"><span>FAIL-OPEN PATH</span><p>Auction → winner → runner-up → hard cutoff → public liquidation</p></div></aside></div> }

function MatchedState({ onSettle }: { onSettle: () => void }) { return <div className="demo-state outcome-layout"><section className="matched-panel panel"><div className="eyebrow success-eyebrow"><Check size={15} /> COMPETITIVE RESCUE MATCHED</div><h3>Winner selected.<br /><em>Position protected.</em></h3><div className="winner-row"><div><span>WINNING PENALTY</span><strong>2.50%</strong></div><div><span>WINNER</span><strong>LIQUIDATOR 03</strong></div><div><span>BOND RETURN</span><strong>1.00 SOL</strong></div></div><button className="settle-button" onClick={onSettle}>COMMIT SETTLEMENT TO SOLANA <ArrowRight size={16} /></button></section><aside className="compare-tease"><span>THE DIFFERENCE</span><div><b>8.00%</b><small>PUBLIC</small></div><ChevronRight /><div className="teal-text"><b>2.50%</b><small>RESCUE</small></div></aside></div> }

function SettledState({ onRecord, onReset }: { onRecord: () => void; onReset: () => void }) { return <div className="demo-state settled-layout"><section className="settlement-hero"><div className="eyebrow cyan-eyebrow"><Check size={15} /> SETTLEMENT VERIFIED · RESCUERECORD COMMITTED</div><h3>50% BORROWER<br /><em>SURPLUS SAVED</em></h3><p>The position was rescued at half the cost of public liquidation. The outcome is permanent, portable, and verifiable.</p><div className="settlement-buttons"><button className="record-button" onClick={onRecord}><FileCheck2 size={16} /> VIEW RESCUERECORD</button><button className="subtle-button" onClick={onReset}>RUN ANOTHER INCIDENT</button></div></section><section className="comparison"><div className="comparison-head"><span>SETTLEMENT COMPARISON</span><small>POSITION RP-0427-ALPHA</small></div><div className="comparison-row public"><span>PUBLIC LIQUIDATION</span><strong>8.00%</strong><small>−$996.00</small></div><div className="comparison-row rescue"><span>RESCUE</span><strong>2.50%</strong><small>−$312.00</small></div><div className="saved-row"><span>BORROWER SURPLUS SAVED</span><strong>$684.00</strong></div></section></div> }

function FallbackState({ onReset }: { onReset: () => void }) { return <div className="demo-state fallback-layout"><div className="fallback-alert"><TriangleAlert size={21} /><div><div className="eyebrow danger-eyebrow">HARD CUTOFF REACHED</div><h3>Rescue window expired.</h3><p>No valid winner was matched before the confidential auction closed. The system has failed open to public liquidation.</p></div></div><div className="fallback-path"><div className="path-done">AUCTION <Check /></div><ChevronRight /><div className="path-done">WINNER <Check /></div><ChevronRight /><div className="path-done">RUNNER-UP <Check /></div><ChevronRight /><div className="path-now">HARD CUTOFF <Clock3 /></div><ChevronRight /><div className="path-end">PUBLIC LIQUIDATION</div></div><button className="subtle-button" onClick={onReset}>RESET INCIDENT</button></div> }

function RescueRecord({ onClose }: { onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="record-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="record-modal"><button ref={closeButtonRef} className="close-button" onClick={onClose} aria-label="Close RescueRecord"><X size={18} /></button><div className="record-seal"><FileCheck2 size={23} /></div><div className="eyebrow cyan-eyebrow">VERIFIABLE RESCUERECORD</div><h3 id="record-title">RP-0427-ALPHA</h3><p className="record-copy">A cryptographic receipt of intervention, matching, and settlement.</p><div className="record-list"><RecordRow label="STATUS" value="SETTLED" green /><RecordRow label="WINNING PENALTY" value="2.50%" /><RecordRow label="PUBLIC ALTERNATIVE" value="8.00%" /><RecordRow label="SURPLUS SAVED" value="50%" green /><RecordRow label="PROGRAM" value="Rescue v1.0" /></div><button className="record-button full-button" onClick={onClose}><Copy size={15} /> COPY RECORD ID</button></div></div> }

function Contrast({ label, items, tone }: { label: string; items: string[]; tone: 'danger' | 'safe' }) { return <div className={`contrast-card ${tone}`}><span>{label}</span>{items.map((item) => <p key={item}><i />{item}</p>)}</div> }
function ArchitectureStep({ number, title, copy, active }: { number: string; title: string; copy: string; active?: boolean }) { return <div className={`architecture-step ${active ? 'active' : ''}`}><span>{number}</span><strong>{title}</strong><p>{copy}</p></div> }
function SealStatus({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) { return <div className={`seal-status ${accent || ''}`}>{icon}<span>{label}</span><strong>{value}</strong></div> }
function RecordRow({ label, value, green }: { label: string; value: string; green?: boolean }) { return <div className="record-row"><span>{label}</span><strong className={green ? 'green-text' : ''}>{value}</strong></div> }
function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className="metric"><span>{label}</span><strong className={tone ? `${tone}-text` : ''}>{value}</strong></div> }
