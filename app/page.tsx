import { ArrowDown, ArrowRight, Check, ExternalLink, LockKeyhole, Radio, ShieldCheck, Siren } from 'lucide-react'

const links = [['/demo', 'RUN DEMO'], ['/activity', 'ACTIVITY'], ['/proof/rescue-record-rp-0427', 'PROOF'], ['/verify', 'VERIFY']]

const flow = [
  ['01', 'DETECT', 'A position becomes distressed.'],
  ['02', 'DELEGATE', 'Execution moves into a temporary MagicBlock session.'],
  ['03', 'COMPETE', 'Eligible rescuers submit sealed bids.'],
  ['04', 'SETTLE', 'The best outcome returns value to the borrower.'],
]

export default function Home() {
  return <main className="site-shell console-home">
    <header className="site-nav"><a className="brand" href="/"><span className="brand-mark"><Siren size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></a><nav className="nav-links" aria-label="Protocol navigation">{links.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</nav><span className="network-status"><i /> DEVNET</span></header>
    <div className="protocol-strip" aria-label="Rescue lifecycle"><span><i className="telemetry-dot" /> LIVE PROTOCOL</span><span>DISTRESSED POSITION <ArrowRight size={11} /> PRIVATE INTERVENTION <ArrowRight size={11} /> COMPETITIVE RESCUE <ArrowRight size={11} /> SETTLEMENT</span><span className="strip-right"><b>MAGICBLOCK</b> / EPHEMERAL EXECUTION</span></div>

    <section className="hero-section motion-enter">
      <div className="hero-copy"><div className="eyebrow"><span className="status-pip" /> COMPETITIVE LIQUIDATION INFRASTRUCTURE</div><h1>Your liquidation is <em>competitive.</em></h1><p className="hero-lede">Rescue creates a private intervention market around distressed positions—giving eligible actors a confidential window to compete for the best borrower outcome.</p><div className="hero-actions"><a className="primary-button" href="/demo">ENTER INTERVENTION ZONE <ArrowRight size={16} /></a><a className="text-link" href="#how-it-works">SEE HOW IT WORKS <ArrowDown size={14} /></a></div><div className="hero-proof"><span><LockKeyhole size={13} /> INTENT SEALED UNTIL SETTLEMENT</span><span><ShieldCheck size={13} /> OUTCOME VERIFIABLE</span></div></div>
      <a className="hero-visual" href="/demo" aria-label="Open live Intervention Zone demo"><div className="visual-topline"><span>INTERVENTION ZONE / LIVE PREVIEW</span><span className="visual-live"><i /> OPERATIONAL</span></div><div className="visual-amount">$2,450.00</div><div className="visual-label">DISTRESSED POSITION <span>→</span> SOL / USDC</div><div className="visual-metrics"><div className="metric"><span>TIME REMAINING</span><b>00:42</b></div><div className="metric"><span>SEALED BIDS</span><b>04</b></div><div className="metric"><span>SURPLUS PROTECTED</span><b>$49.50</b></div></div><div className="visual-route"><span>EXECUTION ROUTE</span><strong>BASE SOLANA <ArrowRight size={13} /> EPHEMERAL ROLLUP</strong></div><div className="visual-cta">TOUCH THE LIVE SIMULATOR <ArrowRight size={13} /></div></a>
    </section>

    <section className="simulator-section landing-simulator"><div className="simulator-intro"><div><span className="section-label">THE PRODUCT, FIRST</span><h2>See the intervention<br /><em>before the explanation.</em></h2></div><p>One bounded lifecycle. No public liquidation race.<br />Run the complete simulation in the Intervention Zone.</p></div><div className="landing-zone"><div><span className="purple-eyebrow"><Radio size={14} /> PRIVATE EXECUTION WINDOW</span><h3>Delegate. Compete. Commit.</h3><p>The protocol moves the sensitive moment off the public surface, then records the result permanently.</p></div><div className="landing-zone-actions"><a className="primary-button" href="/demo">RUN THE RESCUE DEMO <ArrowRight size={15} /></a><span>HEALTHY → AT RISK → MATCHED → SETTLED</span></div></div></section>

    <section className="mechanism-section" id="how-it-works"><div className="mechanism-heading"><div><span className="section-label">HOW IT WORKS</span><h2>Four states.<br /><em>One better outcome.</em></h2></div><p>Rescue is not a promise to prevent liquidation. It is a mechanism for making the outcome competitive, bounded, and independently verifiable.</p></div><div className="architecture landing-flow">{flow.map(([number, title, copy], index) => <div className="architecture-step" key={title}><span>{number}</span><strong>{title}</strong><p>{copy}</p>{index < flow.length - 1 && <ArrowRight className="flow-arrow" size={14} />}</div>)}</div></section>

    <section className="thesis-section"><div className="thesis-grid"><div><span className="section-label">THE PROBLEM</span><h2>Public liquidation destroys borrower equity.</h2></div><div><p>Keepers race against the same visible state. The fastest transaction wins—not necessarily the best recovery.</p><p>Rescue inserts a constrained, confidential window where eligible actors compete on the borrower&apos;s behalf.</p></div></div><div className="contrast-row"><article className="contrast-card danger"><span>WITHOUT RESCUE</span><p><i /> PUBLIC RACE / VALUE EXTRACTED</p></article><div className="contrast-arrow"><ArrowRight /></div><article className="contrast-card safe"><span>WITH RESCUE</span><p><i /> PRIVATE COMPETITION / VALUE RETURNED</p></article></div></section>

    <section className="proof-section"><div className="proof-copy"><span className="section-label">THE PERMANENT ARTIFACT</span><h2>Every intervention leaves a <em>RescueRecord.</em></h2><p>Execution can happen in an ephemeral environment. The outcome does not disappear. Inspect the anchored record, settlement terms, and surplus returned.</p><a href="/proof/rescue-record-rp-0427" className="text-link">INSPECT A COMPLETED RESCUE <ExternalLink size={13} /></a></div><div className="proof-stat"><span>BORROWER SURPLUS SAVED</span><strong>$49.50</strong><b>2.50% RESCUE PENALTY</b><small>RECORD RP-0427 · SETTLED</small></div></section>

    <section className="console-actions"><a href="/demo" className="action-link"><LockKeyhole /> <span><b>RUN THE INTERVENTION</b><small>Touch the complete lifecycle</small></span><ArrowRight /></a><a href="/activity" className="action-link"><Radio /> <span><b>INSPECT LIVE ACTIVITY</b><small>Follow protocol events as they settle</small></span><ArrowRight /></a></section>
    <footer className="site-footer"><div className="brand"><span className="brand-mark"><Siren size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></div><p>A competitive intervention primitive for Solana.</p><a href="/verify">JUDGE VERIFICATION <ExternalLink size={13} /></a></footer>
  </main>
}
