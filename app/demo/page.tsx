'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Check, ChevronRight, CircleAlert, Clock3, Copy, ExternalLink,
  FileCheck2, LockKeyhole, Radio, ShieldAlert, ShieldCheck, Siren, TriangleAlert, X,
} from 'lucide-react'

type Phase = 'healthy' | 'risk' | 'intervention' | 'matched' | 'settled' | 'expired'
const phases: { id: Phase; label: string }[] = [
  { id: 'healthy', label: 'HEALTHY' }, { id: 'risk', label: 'AT RISK' },
  { id: 'intervention', label: 'TEE INTERVENTION' }, { id: 'matched', label: 'MATCHED' }, { id: 'settled', label: 'SETTLED' },
]

export default function Page() {
  const [phase, setPhase] = useState<Phase>('healthy')
  const [seconds, setSeconds] = useState(60)
  const [mevLog, setMevLog] = useState<string[]>([])
  const [receipt, setReceipt] = useState(false)
  const index = useMemo(() => phase === 'expired' ? 2 : phases.findIndex((item) => item.id === phase), [phase])
  useEffect(() => {
    if (phase !== 'intervention') return
    if (seconds <= 0) { setPhase('expired'); return }
    const timeout = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timeout)
  }, [phase, seconds])
  const crash = () => { setPhase('risk'); setSeconds(60) }
  const reset = () => { setPhase('healthy'); setSeconds(60); setMevLog([]); setReceipt(false) }
  const probe = () => setMevLog((current) => [...current, `[22:42:${String(7 + current.length).padStart(2, '0')}] ❌ TRANSACTION REJECTED — Error 3007`])
  return <main className="hud-shell">
    <header className="hud-nav">
      <a className="hud-brand" href="#top"><span><Siren size={16} /></span> RESCUE <b>PROTOCOL</b></a>
      <div className="telemetry"><Telemetry label="SOLANA DEVNET" value="Slot 284,719,402" /><Telemetry label="MAGICBLOCK TEE" value="OPERATIONAL" good /><Telemetry label="PYTH SOL/USD" value="$100.00" /></div>
      <div className="hud-actions"><div className="view-tabs"><button className="selected"><Radio size={13} /> Live Console</button><button>Invariant Checks</button><button>Proof Inspector</button></div><button className="incident-button" onClick={crash}><Siren size={14} /> Simulate Incident</button></div>
    </header>
    <section className="mission-head" id="top"><div><div className="hud-eyebrow"><span className="pulse" /> INSTITUTIONAL RESCUE CONSOLE / DEVNET</div><h1>Defense against the <em>liquidation race.</em></h1><p>Monitor a borrower position, trigger the incident, and watch a sealed MagicBlock intervention commit a better outcome to Solana.</p></div><div className="program-badge"><span>DEVNET PROGRAM</span><strong>GCcUbg...TtxDBT</strong><small>RESCUE PROTOCOL v1.0</small></div></section>
    <section className="lifecycle"><div className="lifecycle-label">PROTOCOL LIFECYCLE <span>RP-0427-ALPHA</span></div><div className="lifecycle-rail">{phases.map((item, i) => <button key={item.id} onClick={() => item.id === 'intervention' ? setPhase('intervention') : setPhase(item.id)} className={`${i < index ? 'done' : ''} ${item.id === phase ? 'current' : ''}`}><span>{i < index ? <Check size={13} /> : i + 1}</span><b>{item.label}</b>{item.id === 'healthy' && <small>HF 1.31</small>}{item.id === 'risk' && <small>HF 0.88</small>}{item.id === 'intervention' && <small>60s AUCTION</small>}{item.id === 'matched' && <small>2.50% PENALTY</small>}{item.id === 'settled' && <small>L1 ANCHOR</small>}</button>)}</div></section>
    <section className="cockpit-grid">
      <PositionCard phase={phase} onCrash={crash} onRestore={reset} />
      <InterventionCard phase={phase} seconds={seconds} onEnter={() => { setPhase('intervention'); setSeconds(60) }} onMatch={() => setPhase('matched')} onExpire={() => setPhase('expired')} />
      <MevTerminal logs={mevLog} onProbe={probe} />
    </section>
    <section className="surplus-banner"><div><div className="hud-eyebrow cyan"><Check size={14} /> SETTLEMENT COMPARISON / VERIFIED PATH</div><h2>Rescue protects the borrower&apos;s <em>remaining equity.</em></h2><p>Public liquidation extracts value at speed. The sealed reverse auction preserves it through competitive intervention.</p></div><div className="surplus-compare"><div><span>PUBLIC LIQUIDATION</span><b>8.00%</b><small>−$72.00 equity lost</small></div><ChevronRight /><div className="cyan"><span>RESCUE WINNER</span><b>2.50%</b><small>−$22.50 equity lost</small></div></div><div className="surplus-stat"><span>BORROWER SURPLUS SAVED</span><strong>+$49.50</strong><small>+5.50% retained equity</small></div><button className="receipt-trigger" onClick={() => setReceipt(true)}><FileCheck2 size={15} /> Inspect RescueRecord PDA <ExternalLink size={13} /></button></section>
    {receipt && <Receipt onClose={() => setReceipt(false)} />}
    <footer className="hud-footer"><span><Siren size={14} /> RESCUE PROTOCOL / MAGICBLOCK DEFENSE HUD</span><button onClick={reset}>RESET SIMULATION</button></footer>
  </main>
}

function Telemetry({ label, value, good }: { label: string; value: string; good?: boolean }) { return <div className="telemetry-item"><span><i className={good ? 'good' : ''} />{label}</span><b>{value}</b></div> }
function PositionCard({ phase, onCrash, onRestore }: { phase: Phase; onCrash: () => void; onRestore: () => void }) { const risk = phase !== 'healthy'; return <section className={`hud-card position-card ${risk ? 'danger-card' : ''}`}><div className="card-top"><span><ShieldCheck size={15} /> MONITORED BORROWER POSITION</span><b className={risk ? 'danger' : 'good'}>{risk ? 'AT RISK' : 'HEALTHY'}</b></div><div className="borrower-id">RP-0427-ALPHA <small>ACTIVE WATCH</small></div><div className="gauge-wrap"><div className={`gauge ${risk ? 'gauge-danger' : ''}`}><strong>{risk ? '0.88' : '1.31'}</strong><span>HEALTH FACTOR</span></div><div className="position-values"><div><span>COLLATERAL</span><b>{risk ? '8.20' : '10.00'} SOL</b><small>${risk ? '820.00' : '1,000.00'}</small></div><div><span>BORROWED DEBT</span><b>$900.00</b><small>USDC</small></div><div><span>LIQUIDATION BOUNDARY</span><b>$86.00</b><small>SOL / THRESHOLD</small></div></div></div><div className="card-controls">{risk ? <button className="restore-button" onClick={onRestore}><ShieldCheck size={15} /> Restore Position</button> : <button className="crash-button" onClick={onCrash}><TriangleAlert size={15} /> Simulate Market Crash <small>(−18% SOL)</small></button>}</div></section> }
function InterventionCard({ phase, seconds, onEnter, onMatch, onExpire }: { phase: Phase; seconds: number; onEnter: () => void; onMatch: () => void; onExpire: () => void }) { const active = phase === 'intervention'; const matched = phase === 'matched' || phase === 'settled'; return <section className="tee-card"><div className="tee-scan" /><div className="card-top"><span className="violet"><span className="pulse violet-pulse" /> MAGICBLOCK EPHEMERAL ROLLUP</span><b>TEE / PER</b></div><h2>Intervention <em>zone.</em></h2><p className="tee-copy">Position delegation creates a confidential execution layer where liquidators compete without exposing bid values.</p><div className="tee-timer"><div className="timer-ring"><strong>{active ? `00:${String(seconds).padStart(2, '0')}` : matched ? 'MATCHED' : '00:60'}</strong><span>{matched ? 'WINNER SELECTED' : 'AUCTION WINDOW'}</span></div><div className="bid-stream"><Bid slot="304892" bidder="7xK9..." num="01" /><Bid slot="304899" bidder="2mP4..." num="02" /><Bid slot="304904" bidder="9qL1..." num="03" /></div></div><div className="reserve-banner"><ShieldCheck size={16} /><span><b>P_reserve CAP: 6.50%</b> Borrower guaranteed to save ≥ 1.50% vs public liquidation.</span></div>{phase === 'risk' ? <button className="violet-button" onClick={onEnter}>Enter TEE Intervention <ArrowRight size={15} /></button> : active ? <div className="tee-buttons"><button className="violet-button" onClick={onMatch}>Match Lowest Bidder <ArrowRight size={15} /></button><button className="ghost-button" onClick={onExpire}>Let Auction Expire</button></div> : <div className="waiting-state"><LockKeyhole size={14} /> {matched ? 'RESCUE WINNER READY FOR L1 SETTLEMENT' : 'AWAITING POSITION DELEGATION'}</div>}</section> }
function Bid({ slot, bidder, num }: { slot: string; bidder: string; num: string }) { return <div className="bid"><span>[Slot {slot}]</span><b>Liquidator {bidder}</b><small><LockKeyhole size={11} /> Sealed Bid #{num}</small></div> }
function MevTerminal({ logs, onProbe }: { logs: string[]; onProbe: () => void }) { return <section className="hud-card terminal-card"><div className="card-top"><span><ShieldAlert size={15} /> MEV ATTACK INTERCEPTOR</span><b className="danger">L1 MUTATION LOCKED</b></div><div className="terminal"><div className="terminal-head"><span>ATTACKCONSOLE / RPC STREAM</span><i>● LIVE</i></div><code><span>[22:42:01]</span> Keeper triggered delegation → Position delegated to TEE ER{`\n`}<span>[22:42:03]</span> Jito Searcher 8xA4... detected underwater collateral{`\n`}<span>[22:42:04]</span> Searcher calling liquidate() with 500 SOL priority bribe...{`\n`}<strong>[22:42:05] ❌ TRANSACTION REJECTED by Solana Runtime: Error 3007</strong>{`\n`}<span>[22:42:05]</span> AccountOwnedByWrongProgram: L1 mutation locked by DLP{`\n`}<span>[22:42:06]</span> MEV front-run deflected. Sealed auction running in enclave...{logs.length ? `\n${logs.join('\n')}` : ''}</code></div><button className="probe-button" onClick={onProbe}><Siren size={14} /> Probe MEV Attack <ArrowRight size={14} /></button><p className="terminal-note"><CircleAlert size={13} /> Probe manually to trigger a live Error 3007 rejection.</p></section> }
function Receipt({ onClose }: { onClose: () => void }) { return <div className="receipt-backdrop" role="dialog" aria-modal="true"><section className="receipt-modal"><button className="close-receipt" onClick={onClose} aria-label="Close receipt"><X size={17} /></button><div className="receipt-icon"><FileCheck2 size={23} /></div><div className="hud-eyebrow cyan">VERIFIABLE RESCUERECORD PDA</div><h2>RP-0427-ALPHA</h2><p>Cryptographic receipt of intervention, matching, and durable settlement.</p><div className="receipt-id"><span>PDA ADDRESS</span><code>7xRscu...PDA0427...Solana</code><button onClick={() => navigator.clipboard?.writeText('7xRscu...PDA0427...Solana')} aria-label="Copy PDA"><Copy size={14} /></button></div><div className="invariants"><div><Check size={14} /><span><b>I₁</b> No public liquidation race permitted before intervention resolves.</span></div><div><Check size={14} /><span><b>I₆</b> L1 mutation rejected with Error 3007 while delegated.</span></div><div><Check size={14} /><span><b>I₁₀</b> Settlement produces durable on-chain RescueRecord PDA.</span></div></div><div className="receipt-actions"><button onClick={() => navigator.clipboard?.writeText('RP-0427-ALPHA')}><Copy size={14} /> Copy Receipt ID</button><a href="https://explorer.solana.com" target="_blank" rel="noreferrer">Open on Solana Explorer <ExternalLink size={13} /></a></div></section></div> }

export { PositionCard, InterventionCard, MevTerminal }
