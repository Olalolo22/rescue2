import { ArrowRight, Check, LockKeyhole, Radio, ShieldCheck } from 'lucide-react'

const steps = [
  ['01', 'DETECT', 'A monitored position crosses its liquidation threshold.'],
  ['02', 'DELEGATE', 'The sensitive execution window moves into a MagicBlock TEE.'],
  ['03', 'COMPETE', 'Eligible rescuers commit sealed routes without seeing one another.'],
  ['04', 'SETTLE', 'The best borrower outcome anchors as a durable RescueRecord.'],
]

export default function Protocol() {
  return <main className="site-shell console-page"><Header /><div className="page-heading"><span className="section-label">PROTOCOL / MECHANISM</span><h1>Protection before<br /><em>liquidation.</em></h1><p>Rescue Protocol turns a distressed position into a bounded intervention market. The goal is not to stop risk—it is to make the final outcome competitive, private, and verifiable.</p></div><section className="architecture protocol-steps">{steps.map(([number, title, copy], index) => <div className="architecture-step" key={title}><span>{number}</span><strong>{title}</strong><p>{copy}</p>{index < steps.length - 1 && <ArrowRight className="flow-arrow" size={14} />}</div>)}</section><section className="protocol-split"><article className="console-card accent-card"><span className="section-label">PRIVATE EXECUTION</span><h2>MagicBlock keeps the rescue window <em>sealed.</em></h2><p>Delegated state creates a temporary execution layer where rescuers can compete without exposing bid values or racing public liquidation.</p><div className="mini-flow"><LockKeyhole size={14} /> SEALED INTENT <ArrowRight size={14} /> PRIVATE MATCH <ArrowRight size={14} /> PUBLIC RECEIPT</div></article><article className="console-card"><span className="section-label">PUBLIC GUARANTEE</span><h2>What is private in execution becomes public in <em>proof.</em></h2><p>Only the selected route, settlement terms, and preserved surplus are anchored. Anyone can inspect the resulting RescueRecord.</p><div className="mini-flow"><ShieldCheck size={14} /> OUTCOME VERIFIABLE <ArrowRight size={14} /> <a href="/verify">CHECK INVARIANTS</a></div></article></section><section className="console-actions"><a href="/demo" className="action-link"><Radio /><span><b>RUN THE INTERVENTION</b><small>Walk through the complete lifecycle</small></span><ArrowRight /></a><a href="/proof/rescue-record-rp-0427" className="action-link"><Check /><span><b>INSPECT THE RECEIPT</b><small>See what survives the private window</small></span><ArrowRight /></a></section></main>
}

function Header() { return <header className="site-nav"><a className="brand" href="/"><span className="brand-mark"><ShieldCheck size={15} /></span><span>RESCUE <b>PROTOCOL</b></span></a><nav className="nav-links" aria-label="Protocol navigation"><a href="/protocol">PROTOCOL</a><a href="/demo">DEMO</a><a href="/activity">ACTIVITY</a><a href="/verify">VERIFY</a></nav><span className="network-status"><i /> DEVNET</span></header> }

export const metadata = { title: 'Protocol | Rescue Protocol', description: 'How Rescue Protocol protects distressed positions before liquidation.' }

export { Header }
