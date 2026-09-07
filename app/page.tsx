'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  FileCheck2,
  LockKeyhole,
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
    if (phase !== 'intervention' || seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase, seconds])

  const hasCrashed = phase !== 'healthy'
  const activeIndex = useMemo(() => phase === 'fallback' ? 2 : phases.findIndex((item) => item.id === phase), [phase])
  const beginRisk = () => { setPhase('at-risk'); setSeconds(60) }
  const openZone = () => { setPhase('intervention'); setSeconds(60) }
  const match = () => setPhase('matched')
  const settle = () => setPhase('settled')
  const expire = () => setPhase('fallback')
  const reset = () => { setPhase('healthy'); setSeconds(60) }

  return (
    <main className="protocol-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><Siren size={16} /></div><span>RESCUE <b>PROTOCOL</b></span></div>
        <div className="topbar-meta"><span className="live-dot" /> TESTNET / DEVNET <span className="topbar-divider" /> INCIDENT SIMULATOR <button className="reset-button" onClick={reset}>RESET</button></div>
      </header>

      <section className={`incident-header ${hasCrashed ? 'is-live' : ''}`}>
        <div className="eyebrow"><span className="status-pip" /> FINANCIAL EMERGENCY RESPONSE SYSTEM</div>
        <div className="hero-row">
          <div>
            <h1>{phase === 'healthy' ? 'Protection before liquidation.' : phase === 'settled' ? 'The position survived.' : 'A liquidation event is unfolding.'}</h1>
            <p className="lede">Rescue removes an unsafe position from public liquidation and opens a confidential window for competitive intervention.</p>
          </div>
          <div className="incident-id"><span>INCIDENT</span><strong>RP-0427-ALPHA</strong><small>AWAITING TRIGGER</small></div>
        </div>
        <div className="phase-rail" aria-label="Rescue lifecycle">
          {phases.map((item, index) => <div key={item.id} className={`phase-step ${index < activeIndex ? 'done' : ''} ${item.id === phase ? 'current' : ''}`}><span>{index < activeIndex ? <Check size={13} /> : index + 1}</span><b>{item.label}</b>{index < phases.length - 1 && <i />}</div>)}
          {phase === 'fallback' && <div className="fallback-rail-label"><TriangleAlert size={13} /> EXPIRED / FAIL-OPEN</div>}
        </div>
      </section>

      {phase === 'healthy' && <HealthyState onCrash={beginRisk} />}
      {phase === 'at-risk' && <AtRiskState onRescue={openZone} />}
      {phase === 'intervention' && <InterventionZone seconds={seconds} onMatch={match} onExpire={expire} />}
      {phase === 'matched' && <MatchedState onSettle={settle} />}
      {phase === 'settled' && <SettledState onRecord={() => setRecordOpen(true)} onReset={reset} />}
      {phase === 'fallback' && <FallbackState onReset={reset} />}

      {recordOpen && <RescueRecord onClose={() => setRecordOpen(false)} />}
    </main>
  )
}

function HealthyState({ onCrash }: { onCrash: () => void }) {
  return <div className="state-layout quiet-layout"><section className="position-card panel"><div className="panel-kicker"><ShieldCheck size={16} /> MONITORED POSITION <span className="safe-tag">SAFE</span></div><div className="position-value">$12,480.00</div><div className="position-sub">SOL collateralized debt position</div><div className="metrics-grid"><Metric label="SOL PRICE" value="$100.00" /><Metric label="HEALTH FACTOR" value="1.31" /><Metric label="LIQUIDATION THRESHOLD" value="$86.00" /></div><button className="primary-button trigger-button" onClick={onCrash}><Siren size={17} /> SIMULATE MARKET DROP <ArrowRight size={16} /></button><p className="fine-print">Trigger a controlled market event to observe the emergency response.</p></section><aside className="principles"><span className="eyebrow">THE RESCUE PRINCIPLE</span><h2>Liquidation is not inevitable.</h2><p>When collateral crosses the danger line, Rescue buys the borrower a private moment to find a better outcome.</p><div className="principle-line"><LockKeyhole size={15} /><span>CONFIDENTIAL BY DEFAULT</span></div><div className="principle-line"><ShieldCheck size={15} /><span>FAILS OPEN, NEVER GUARANTEES</span></div></aside></div>
}

function AtRiskState({ onRescue }: { onRescue: () => void }) {
  return <div className="state-layout risk-layout"><section className="crash-panel"><div className="eyebrow danger-eyebrow"><CircleAlert size={15} /> MARKET EVENT DETECTED</div><h2>POSITION AT RISK</h2><div className="crash-values"><div><span>SOL PRICE</span><strong>$100 <i>→</i> $82</strong><small className="danger-text">−18.00%</small></div><div><span>HEALTH FACTOR</span><strong>1.31 <i>→</i> 0.88</strong><small className="danger-text">BELOW THRESHOLD</small></div></div><div className="danger-rule"><span /><b>PUBLIC LIQUIDATION ELIGIBLE</b></div></section><section className="rescue-cta panel"><div className="panel-kicker"><ShieldAlert size={16} /> EMERGENCY RESPONSE</div><h3>Protect this position<br /><em>before it&apos;s public.</em></h3><p>Rescue temporarily blocks public liquidation and creates a 60-second confidential window for competitive intervention.</p><button className="rescue-button" onClick={onRescue}>ENTER INTERVENTION ZONE <ArrowRight size={17} /></button><div className="cta-note"><Clock3 size={14} /> 60 SECONDS · BOND REQUIRED · FAILS OPEN</div></section></div>
}

function InterventionZone({ seconds, onMatch, onExpire }: { seconds: number; onMatch: () => void; onExpire: () => void }) {
  return <div className="zone-layout"><section className="zone-panel"><div className="zone-header"><div><div className="eyebrow purple-eyebrow"><span className="pulse-dot" /> ACTIVE PROTECTION</div><h2>INTERVENTION ZONE</h2><p>Position removed from public liquidation. Competitive rescue window is open.</p></div><div className="countdown"><span>TIME REMAINING</span><strong>00:{String(seconds).padStart(2, '0')}</strong><div className="countdown-track"><i style={{ width: `${(seconds / 60) * 100}%` }} /></div></div></div><div className="sealed-grid"><SealStatus icon={<ShieldCheck />} label="PUBLIC LIQUIDATION" value="BLOCKED" accent="green" /><SealStatus icon={<LockKeyhole />} label="BID STATUS" value="SEALED" /><SealStatus icon={<FileCheck2 />} label="LIQUIDATORS" value="3 CONNECTED" /><SealStatus icon={<Copy />} label="COMPETITOR VISIBILITY" value="CANNOT READ" /></div><div className="zone-actions"><button className="match-button" onClick={onMatch}>CLOSE AUCTION &amp; MATCH WINNER <ArrowRight size={16} /></button><button className="subtle-button" onClick={onExpire}>LET AUCTION EXPIRE</button></div><p className="zone-disclaimer"><LockKeyhole size={13} /> No bid values are visible while the auction is open. Winner is selected by the lowest valid penalty.</p></section><aside className="event-stack"><div className="stack-label">PROTOCOL ACTIVITY</div><div className="blocked-event"><div className="event-icon"><ShieldAlert size={18} /></div><div><span>LIQUIDATION ATTEMPT BLOCKED</span><b>Error 3007 — AccountOwnedByWrongProgram</b><small>PUBLIC KEEPER · 00:42 AGO</small></div></div><div className="fallback-mini"><span>FAIL-OPEN PATH</span><p>Auction → winner → runner-up → hard cutoff → public liquidation</p></div></aside></div>
}

function SealStatus({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) { return <div className={`seal-status ${accent || ''}`}>{icon}<span>{label}</span><strong>{value}</strong></div> }

function MatchedState({ onSettle }: { onSettle: () => void }) {
  return <div className="outcome-layout"><section className="matched-panel panel"><div className="eyebrow success-eyebrow"><Check size={15} /> COMPETITIVE RESCUE MATCHED</div><h2>Winner selected.<br /><em>Position protected.</em></h2><div className="winner-row"><div><span>WINNING PENALTY</span><strong>2.50%</strong></div><div><span>WINNER</span><strong>LIQUIDATOR 03</strong></div><div><span>BOND RETURN</span><strong>1.00 SOL</strong></div></div><button className="settle-button" onClick={onSettle}>EXECUTE SETTLEMENT <ArrowRight size={16} /></button></section><aside className="compare-tease"><span>THE DIFFERENCE</span><div><b>8.00%</b><small>PUBLIC</small></div><ChevronRight /><div className="teal-text"><b>2.50%</b><small>RESCUE</small></div></aside></div>
}

function SettledState({ onRecord, onReset }: { onRecord: () => void; onReset: () => void }) {
  return <div className="settled-layout"><section className="settlement-hero"><div className="eyebrow cyan-eyebrow"><Check size={15} /> SETTLEMENT VERIFIED · RESCUERECORD COMMITTED</div><h2>50% BORROWER<br /><em>SURPLUS SAVED</em></h2><p>The position was rescued at half the cost of public liquidation. The outcome is permanent, portable, and verifiable.</p><div className="settlement-buttons"><button className="record-button" onClick={onRecord}><FileCheck2 size={16} /> VIEW RESCUERECORD</button><button className="subtle-button" onClick={onReset}>RUN ANOTHER INCIDENT</button></div></section><section className="comparison"><div className="comparison-head"><span>SETTLEMENT COMPARISON</span><small>POSITION RP-0427-ALPHA</small></div><div className="comparison-row public"><span>PUBLIC LIQUIDATION</span><strong>8.00%</strong><small>−$996.00</small></div><div className="comparison-row rescue"><span>RESCUE</span><strong>2.50%</strong><small>−$312.00</small></div><div className="saved-row"><span>BORROWER SURPLUS SAVED</span><strong>$684.00</strong></div></section></div>
}

function FallbackState({ onReset }: { onReset: () => void }) { return <div className="fallback-layout"><div className="fallback-alert"><TriangleAlert size={21} /><div><div className="eyebrow danger-eyebrow">HARD CUTOFF REACHED</div><h2>Rescue window expired.</h2><p>No valid winner was matched before the confidential auction closed. The system has failed open to public liquidation.</p></div></div><div className="fallback-path"><div className="path-done">AUCTION <Check /></div><ChevronRight /><div className="path-done">WINNER <Check /></div><ChevronRight /><div className="path-done">RUNNER-UP <Check /></div><ChevronRight /><div className="path-now">HARD CUTOFF <Clock3 /></div><ChevronRight /><div className="path-end">PUBLIC LIQUIDATION</div></div><button className="subtle-button" onClick={onReset}>RESET INCIDENT</button></div> }

function RescueRecord({ onClose }: { onClose: () => void }) { return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="RescueRecord"><div className="record-modal"><button className="close-button" onClick={onClose} aria-label="Close"><X size={18} /></button><div className="record-seal"><FileCheck2 size={23} /></div><div className="eyebrow cyan-eyebrow">VERIFIABLE RESCUERECORD</div><h2>RP-0427-ALPHA</h2><p className="record-copy">A cryptographic receipt of intervention, matching, and settlement.</p><div className="record-list"><RecordRow label="STATUS" value="SETTLED" green /><RecordRow label="WINNING PENALTY" value="2.50%" /><RecordRow label="PUBLIC ALTERNATIVE" value="8.00%" /><RecordRow label="SURPLUS SAVED" value="50%" green /><RecordRow label="PROGRAM" value="Rescue v1.0" /></div><button className="record-button full-button" onClick={onClose}><Copy size={15} /> COPY RECORD ID</button></div></div> }
function RecordRow({ label, value, green }: { label: string; value: string; green?: boolean }) { return <div className="record-row"><span>{label}</span><strong className={green ? 'green-text' : ''}>{value}</strong></div> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div> }
