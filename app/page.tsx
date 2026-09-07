import { ArrowDown, ArrowRight, Check, ExternalLink, LockKeyhole, Radio, ShieldCheck, Siren } from 'lucide-react'

const links = [
  ['/demo', 'RUN DEMO'],
  ['/activity', 'ACTIVITY'],
  ['/proof/rescue-record-rp-0427', 'PROOF'],
  ['/verify', 'VERIFY'],
]

const flow = [
  ['01', 'DETECT', 'A position becomes distressed.'],
  ['02', 'DELEGATE', 'Execution moves into a private session.'],
  ['03', 'COMPETE', 'Eligible rescuers submit sealed bids.'],
  ['04', 'SETTLE', 'The best outcome returns value to the borrower.'],
]

export default function Home() {
  return (
    <main className="site-shell console-home">
      <header className="site-nav">
        <a className="brand" href="/" aria-label="Rescue Protocol home">
          <span className="brand-mark"><Siren size={15} /></span>
          <span>RESCUE <b>PROTOCOL</b></span>
        </a>
        <nav className="nav-links" aria-label="Protocol navigation">
          {links.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        </nav>
        <span className="network-status"><i /> DEVNET</span>
      </header>

      <div className="protocol-strip" aria-label="Rescue lifecycle">
        <span><i className="telemetry-dot" /> LIVE PROTOCOL</span>
        <span className="strip-flow">DISTRESSED POSITION <ArrowRight size={11} /> PRIVATE INTERVENTION <ArrowRight size={11} /> COMPETITIVE RESCUE <ArrowRight size={11} /> SETTLEMENT</span>
        <span className="strip-right"><b>MAGICBLOCK</b> / EPHEMERAL EXECUTION</span>
      </div>

      <section className="hero-section motion-enter">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-pip" /> COMPETITIVE LIQUIDATION INFRASTRUCTURE</div>
          <h1>Make liquidation <em>competitive.</em></h1>
          <p className="hero-lede">Rescue gives eligible actors a confidential window to compete for the best borrower outcome before a distressed position reaches the public market.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/demo">ENTER INTERVENTION ZONE <ArrowRight size={16} /></a>
            <a className="text-link" href="#how-it-works">HOW IT WORKS <ArrowDown size={14} /></a>
          </div>
          <div className="hero-proof"><span><LockKeyhole size={13} /> INTENT SEALED UNTIL SETTLEMENT</span><span><ShieldCheck size={13} /> OUTCOME VERIFIABLE</span></div>
        </div>

        <a className="hero-visual" href="/demo" aria-label="Open live Intervention Zone demo">
          <div className="visual-topline"><span>INTERVENTION ZONE / LIVE PREVIEW</span><span className="visual-live"><i /> OPERATIONAL</span></div>
          <div className="visual-amount">$2,450.00</div>
          <div className="visual-label">DISTRESSED POSITION <span>→</span> SOL / USDC</div>
          <div className="visual-metrics">
            <div className="metric"><span>TIME REMAINING</span><b>00:42</b></div>
            <div className="metric"><span>SEALED BIDS</span><b>04</b></div>
            <div className="metric"><span>SURPLUS PROTECTED</span><b>$49.50</b></div>
          </div>
          <div className="visual-route"><span>EXECUTION ROUTE</span><strong>BASE SOLANA <ArrowRight size={13} /> EPHEMERAL ROLLUP</strong></div>
          <div className="visual-cta">OPEN LIVE SIMULATOR <ArrowRight size={13} /></div>
        </a>
      </section>

      <section className="mechanism-section" id="how-it-works">
        <div className="mechanism-heading">
          <div><span className="section-label">THE RESCUE LIFECYCLE</span><h2>Four states.<br /><em>One better outcome.</em></h2></div>
          <p>Rescue is a bounded mechanism for making liquidation outcomes competitive, private, and independently verifiable.</p>
        </div>
        <div className="architecture landing-flow">
          {flow.map(([number, title, copy], index) => <div className="architecture-step" key={title}><span>{number}</span><strong>{title}</strong><p>{copy}</p>{index < flow.length - 1 && <ArrowRight className="flow-arrow" size={14} />}</div>)}
        </div>
      </section>

      <section className="proof-section">
        <div className="proof-copy">
          <span className="section-label">THE PERMANENT ARTIFACT</span>
          <h2>Private execution.<br /><em>Publicly verifiable.</em></h2>
          <p>Execution can happen in an ephemeral environment. The outcome does not disappear. Inspect the anchored record, settlement terms, and surplus returned.</p>
          <div className="proof-links"><a href="/proof/rescue-record-rp-0427" className="text-link">INSPECT RESCUE RECORD <ExternalLink size={13} /></a><a href="/verify" className="text-link">VERIFY THE PROTOCOL <Check size={13} /></a></div>
        </div>
        <div className="proof-stat"><span>BORROWER SURPLUS SAVED</span><strong>$49.50</strong><b>2.50% RESCUE PENALTY</b><small>RECORD RP-0427 · SETTLED</small></div>
      </section>

      <footer className="site-footer"><div className="brand"><span className="brand-mark"><Siren size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></div><p>A competitive intervention primitive for Solana.</p><a href="/demo" className="footer-cta">RUN THE INTERVENTION <Radio size={13} /></a></footer>
    </main>
  )
}
