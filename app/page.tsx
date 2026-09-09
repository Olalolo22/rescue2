'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ExternalLink,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Siren,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'
import { PositionTelemetry, INITIAL_TELEMETRY } from '@/lib/protocol/engine'
import { fetchLiveTelemetryApi } from '@/lib/protocol/engine'

export default function Home() {
  const pageRef = useRef<HTMLElement>(null)
  const [telemetry, setTelemetry] = useState<PositionTelemetry>(INITIAL_TELEMETRY)
  const [liveSlot, setLiveSlot] = useState<number>(284719445)
  const [networkLatency, setNetworkLatency] = useState<number>(14)

  // Scroll-reveal
  useEffect(() => {
    const sections = pageRef.current?.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!sections) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.16, rootMargin: '0px 0px -40px' }
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  // Poll live Solana Devnet telemetry — only used for the hero liveness card
  useEffect(() => {
    let mounted = true
    async function poll() {
      const data = await fetchLiveTelemetryApi()
      if (!mounted || !data) return
      setLiveSlot(data.slot)
      setNetworkLatency(data.latencyMs)
      if (data.pythSolPriceUsd) {
        setTelemetry((prev) => ({
          ...prev,
          solPriceUsd: data.pythSolPriceUsd,
          collateralUsd: prev.collateralSol * data.pythSolPriceUsd,
        }))
      }
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <main ref={pageRef} className="site-shell console-home">
      <Navbar />

      {/* ── LIVENESS STRIP ── */}
      <div className="protocol-strip" aria-label="Protocol status">
        <span>
          <i className="telemetry-dot" /> DEVNET
        </span>
        <span>
          SLOT: <b>{liveSlot.toLocaleString()}</b>
        </span>
        <span>
          PYTH SOL/USD: <b>${telemetry.solPriceUsd.toFixed(2)}</b>
        </span>
        <span>
          LATENCY: <b>{networkLatency}ms</b>
        </span>
        <span className="strip-right">
          <b>MAGICBLOCK</b> / EPHEMERAL EXECUTION
        </span>
      </div>

      {/* ── HERO ── */}
      <section className="hero-section motion-enter">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-pip" /> COMPETITIVE LIQUIDATION INFRASTRUCTURE
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
            <a className="primary-button" href="/demo">
              RUN THE RESCUE DEMO <ArrowRight size={16} />
            </a>
            <a className="text-link" href="#how-it-works">
              SEE HOW IT WORKS <ArrowDown size={14} />
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <LockKeyhole size={13} /> INTENT SEALED UNTIL SETTLEMENT
            </span>
            <span>
              <ShieldCheck size={13} /> OUTCOME VERIFIABLE ON L1
            </span>
          </div>
        </div>

        {/* Live telemetry card — links straight to /demo */}
        <a className="hero-visual" href="/demo" aria-label="Open live Intervention Zone demo">
          <div className="visual-topline">
            <span>INCIDENT {PROTOCOL_CONSTANTS.INCIDENT_ID}</span>
            <span className="visual-live">
              <i /> HEALTHY
            </span>
          </div>
          <div className="visual-amount">
            ${telemetry.collateralUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span> {telemetry.collateralSol.toFixed(2)} SOL collateralized position</span>
          </div>
          <div className="visual-metrics">
            <div className="metric">
              <span>SOL PRICE</span>
              <b>${telemetry.solPriceUsd.toFixed(2)}</b>
            </div>
            <div className="metric">
              <span>HEALTH FACTOR</span>
              <b className="green-text">{telemetry.healthFactor.toFixed(2)}</b>
            </div>
            <div className="metric">
              <span>DEVNET SLOT</span>
              <b>{liveSlot.toLocaleString()}</b>
            </div>
          </div>
          <div className="visual-route">
            <span>BASE SOLANA</span>
            <i />
            <b>MONITORING CRANK ACTIVE</b>
          </div>
          <div className="visual-cta">
            TRIGGER THE RESCUE SIMULATION <ArrowRight size={13} />
          </div>
        </a>
      </section>

      {/* ── PROBLEM ── */}
      <section data-reveal className="thesis-section" id="problem">
        <div className="thesis-grid">
          <div>
            <span className="section-label">THE PROBLEM</span>
            <h2>Public liquidation is a race the borrower has already lost.</h2>
          </div>
          <div>
            <p>
              When collateral crosses the danger line on base Solana, MEV searchers
              immediately snipe the position and extract an 8% penalty in the public
              mempool. The borrower has no recourse, no market, no negotiation.
            </p>
            <p>
              Rescue intercepts the distressed position before that line and delegates
              it into a confidential MagicBlock TEE enclave. Outside bots cannot touch it.
              Inside, liquidators compete to offer the <em>lowest</em> penalty.
            </p>
          </div>
        </div>
        <div className="contrast-row">
          <article className="contrast-card danger">
            <span>PUBLIC LIQUIDATION</span>
            <p><i />Public searcher priority gas race</p>
            <p><i />MEV bots seize 8.00% penalty ($72.00 lost)</p>
            <p><i />Borrower equity cannibalized</p>
          </article>
          <div className="contrast-arrow">
            <ArrowRight />
          </div>
          <article className="contrast-card safe">
            <span>RESCUE PROTOCOL</span>
            <p><i />Confidential 60s reverse auction</p>
            <p><i />Liquidators bid penalty down to 2.50%</p>
            <p><i />Borrower saves +$49.50 equity (+5.50%)</p>
          </article>
        </div>
      </section>

      {/* ── MECHANISM ── */}
      <section data-reveal className="mechanism-section" id="how-it-works">
        <div className="mechanism-heading">
          <div>
            <span className="section-label">THE MAGICBLOCK PRIMITIVE</span>
            <h2>
              One temporary execution layer.<br />
              <em>One better outcome.</em>
            </h2>
          </div>
          <p>
            MagicBlock handles the confidential, high-speed middle of a rescue.
            Solana detects the risk and records the final result.
          </p>
        </div>
        <div className="rescue-path">
          <article className="rescue-node">
            <span>01 / BASE SOLANA</span>
            <strong>Detect</strong>
            <p>Position breaches 1.05 HF. Keeper crank calls initiate_rescue.</p>
          </article>
          <div className="rescue-connector">
            <ArrowRight size={16} />
            <span>DELEGATE</span>
          </div>
          <article className="rescue-node magic-node">
            <span>02 / MAGICBLOCK TEE</span>
            <strong>Protect and compete</strong>
            <p>
              Account locked on L1 with Error 3007. Liquidators submit sealed bids
              inside the TEE — no one reads each other&apos;s terms.
            </p>
            <div className="magic-tags">
              <i>TEE ISOLATION</i>
              <i>PRIVATE STATE</i>
              <i>60s WINDOW</i>
            </div>
          </article>
          <div className="rescue-connector">
            <ArrowRight size={16} />
            <span>COMMIT</span>
          </div>
          <article className="rescue-node">
            <span>03 / BASE SOLANA</span>
            <strong>Settle</strong>
            <p>
              Winning bid commits as an immutable RescueRecord PDA back to L1.
              Position restored. Liquidation never fires.
            </p>
          </article>
        </div>
        <a className="primitive-cta" href="/demo">
          <span>
            <b>SEE THE PROTECTED WINDOW</b>
            <small>Run the rescue and test the private boundary.</small>
          </span>
          <ArrowRight size={16} />
        </a>
      </section>

      {/* ── PROOF ── */}
      <section data-reveal className="proof-section">
        <div className="proof-copy">
          <span className="section-label">THE PERMANENT ARTIFACT</span>
          <h2>
            Every intervention leaves a <em>RescueRecord.</em>
          </h2>
          <p>
            Execution happens in an ephemeral TEE environment. The outcome does not
            disappear. Inspect the anchored record, settlement terms, and surplus
            returned to the borrower.
          </p>
          <a href="/proof/rescue-record-rp-0427" className="text-link">
            INSPECT A COMPLETED RESCUE <ExternalLink size={13} />
          </a>
        </div>
        <div className="proof-stat">
          <span>BORROWER SURPLUS SAVED</span>
          <strong>+5.50%</strong>
          <b>+$49.50 EQUITY RETAINED</b>
          <small>Standard 8.00% public liquidation → 2.50% winning TEE bid</small>
        </div>
      </section>

      {/* ── CONSOLE ACTIONS ── */}
      <section data-reveal className="console-actions">
        <a href="/demo" className="action-link">
          <LockKeyhole />
          <span>
            <b>RUN THE INTERVENTION</b>
            <small>Touch the complete lifecycle</small>
          </span>
          <ArrowRight />
        </a>
        <a href="/activity" className="action-link">
          <Radio />
          <span>
            <b>INSPECT LIVE ACTIVITY</b>
            <small>Follow protocol events as they settle</small>
          </span>
          <ArrowRight />
        </a>
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
          <span>SETTLEMENT: SIMULATED</span>
        </div>
      </footer>
    </main>
  )
}
