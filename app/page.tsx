'use client'

import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowRight, Check, ExternalLink, LockKeyhole, Radio, ShieldCheck, Siren } from 'lucide-react'

const links = [['/demo', 'RUN DEMO'], ['/activity', 'ACTIVITY'], ['/proof/rescue-record-rp-0427', 'PROOF'], ['/verify', 'VERIFY']]



export default function Home() {
  const pageRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const sections = pageRef.current?.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!sections) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.16, rootMargin: '0px 0px -40px' })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return <main ref={pageRef} className="site-shell console-home">
    <header className="site-nav"><a className="brand" href="/"><span className="brand-mark"><Siren size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></a><nav className="nav-links" aria-label="Protocol navigation">{links.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</nav><span className="network-status"><i /> DEVNET</span></header>
    <div className="protocol-strip" aria-label="Rescue lifecycle"><span><i className="telemetry-dot" /> LIVE PROTOCOL</span><span>DISTRESSED POSITION <ArrowRight size={11} /> PRIVATE INTERVENTION <ArrowRight size={11} /> COMPETITIVE RESCUE <ArrowRight size={11} /> SETTLEMENT</span><span className="strip-right"><b>MAGICBLOCK</b> / EPHEMERAL EXECUTION</span></div>

    <section className="hero-section motion-enter">
      <div className="hero-copy"><div className="eyebrow"><span className="status-pip" /> COMPETITIVE LIQUIDATION INFRASTRUCTURE</div><h1>Your liquidation is <em>competitive.</em></h1><p className="hero-lede">Rescue creates a private intervention market around distressed positions—giving eligible actors a confidential window to compete for the best borrower outcome.</p><div className="hero-actions"><a className="primary-button" href="/demo">ENTER INTERVENTION ZONE <ArrowRight size={16} /></a><a className="text-link" href="#how-it-works">SEE HOW IT WORKS <ArrowDown size={14} /></a></div><div className="hero-proof"><span><LockKeyhole size={13} /> INTENT SEALED UNTIL SETTLEMENT</span><span><ShieldCheck size={13} /> OUTCOME VERIFIABLE</span></div></div>
      <a className="hero-visual" href="/demo" aria-label="Open live Intervention Zone demo"><div className="visual-topline"><span>INTERVENTION ZONE / LIVE PREVIEW</span><span className="visual-live"><i /> OPERATIONAL</span></div><div className="visual-amount">$2,450.00</div><div className="visual-label">DISTRESSED POSITION <span>→</span> SOL / USDC</div><div className="visual-metrics"><div className="metric"><span>TIME REMAINING</span><b>00:42</b></div><div className="metric"><span>SEALED BIDS</span><b>04</b></div><div className="metric"><span>SURPLUS PROTECTED</span><b>$49.50</b></div></div><div className="visual-route"><span>EXECUTION ROUTE</span><strong>BASE SOLANA <ArrowRight size={13} /> EPHEMERAL ROLLUP</strong></div><div className="visual-cta">TOUCH THE LIVE SIMULATOR <ArrowRight size={13} /></div></a>
    </section>

    <section data-reveal className="simulator-section landing-simulator"><div className="simulator-intro"><div><span className="section-label">THE PRODUCT, FIRST</span><h2>See the intervention<br /><em>before the explanation.</em></h2></div><p>One bounded lifecycle. No public liquidation race.<br />Run the complete simulation in the Intervention Zone.</p></div><div className="landing-zone"><div><span className="purple-eyebrow"><Radio size={14} /> PRIVATE EXECUTION WINDOW</span><h3>Delegate. Compete. Commit.</h3><p>The protocol moves the sensitive moment off the public surface, then records the result permanently.</p></div><div className="landing-zone-actions"><a className="primary-button" href="/demo">RUN THE RESCUE DEMO <ArrowRight size={15} /></a><span>HEALTHY → AT RISK → MATCHED → SETTLED</span></div></div></section>

    <section data-reveal className="mechanism-section" id="how-it-works"><div className="mechanism-heading"><div><span className="section-label">THE MAGICBLOCK PRIMITIVE</span><h2>One temporary execution layer.<br /><em>One better outcome.</em></h2></div><p>MagicBlock handles the confidential, high-speed middle of a rescue. Solana detects the risk and records the final result.</p></div><div className="rescue-path"><article className="rescue-node"><span>01 / BASE SOLANA</span><strong>Detect</strong><p>A position crosses its liquidation threshold.</p></article><div className="rescue-connector"><ArrowRight size={16} /><span>DELEGATE</span></div><article className="rescue-node magic-node"><span>02 / MAGICBLOCK</span><strong>Protect and compete</strong><p>An Ephemeral Rollup gives rescuers a fast, confidential window to update offers without reading one another&apos;s terms.</p><div className="magic-tags"><i>TEE ISOLATION</i><i>PRIVATE STATE</i><i>HIGH-FREQUENCY</i></div></article><div className="rescue-connector"><ArrowRight size={16} /><span>COMMIT</span></div><article className="rescue-node"><span>03 / BASE SOLANA</span><strong>Settle</strong><p>Only the winning path returns on-chain as a verifiable RescueRecord.</p></article></div><a className="primitive-cta" href="/demo"><span><b>SEE THE PROTECTED WINDOW</b><small>Run the rescue and test the private boundary.</small></span><ArrowRight size={16} /></a></section>

    <section data-reveal className="thesis-section"><div className="thesis-grid"><div><span className="section-label">THE PROBLEM</span><h2>Public liquidation destroys borrower equity.</h2></div><div><p>Keepers race against the same visible state. The fastest transaction wins—not necessarily the best recovery.</p><p>Rescue inserts a constrained, confidential window where eligible actors compete on the borrower&apos;s behalf.</p></div></div><div className="contrast-row"><article className="contrast-card danger"><span>WITHOUT RESCUE</span><p><i /> PUBLIC RACE / VALUE EXTRACTED</p></article><div className="contrast-arrow"><ArrowRight /></div><article className="contrast-card safe"><span>WITH RESCUE</span><p><i /> PRIVATE COMPETITION / VALUE RETURNED</p></article></div></section>

    <section data-reveal className="proof-section"><div className="proof-copy"><span className="section-label">THE PERMANENT ARTIFACT</span><h2>Every intervention leaves a <em>RescueRecord.</em></h2><p>Execution can happen in an ephemeral environment. The outcome does not disappear. Inspect the anchored record, settlement terms, and surplus returned.</p><a href="/proof/rescue-record-rp-0427" className="text-link">INSPECT A COMPLETED RESCUE <ExternalLink size={13} /></a></div><div className="proof-stat"><span>BORROWER SURPLUS SAVED</span><strong>$49.50</strong><b>2.50% RESCUE PENALTY</b><small>RECORD RP-0427 · SETTLED</small></div></section>

    <section data-reveal className="console-actions"><a href="/demo" className="action-link"><LockKeyhole /> <span><b>RUN THE INTERVENTION</b><small>Touch the complete lifecycle</small></span><ArrowRight /></a><a href="/activity" className="action-link"><Radio /> <span><b>INSPECT LIVE ACTIVITY</b><small>Follow protocol events as they settle</small></span><ArrowRight /></a></section>
    <footer className="site-footer"><div className="footer-intro"><div className="brand"><span className="brand-mark"><Siren size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></div><p>A competitive intervention primitive for Solana.<br />MagicBlock-powered execution before liquidation.</p></div><div className="footer-links"><div><span>PROTOCOL</span><a href="/demo">Intervention Zone</a><a href="/activity">Live Activity</a><a href="/proof/rescue-record-rp-0427">RescueRecords</a></div><div><span>VERIFY</span><a href="/verify">Proof Inspector</a><a href="/protocol">How It Works</a><a href="/receipts/rp-0427-alpha">Settlement Receipt</a></div><div><span>ECOSYSTEM</span><a href="https://www.magicblock.xyz/" target="_blank" rel="noreferrer">MagicBlock <ExternalLink size={11} /></a><a href="https://solana.com/" target="_blank" rel="noreferrer">Solana <ExternalLink size={11} /></a><a href="https://github.com/Olalolo22/rescue2" target="_blank" rel="noreferrer">GitHub <ExternalLink size={11} /></a></div></div><div className="footer-bottom"><span>© 2026 RESCUE PROTOCOL</span><span><i /> DEVNET PROTOTYPE</span><span>TEE STATUS: SIMULATED</span><span>SETTLEMENT: SIMULATED</span></div></footer>
  </main>
}
