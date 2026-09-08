import { Check, ExternalLink, FileCheck2, GitBranch, ShieldCheck } from 'lucide-react'
import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'
import { Navbar } from '@/components/Navbar'

const checks = [
  ['I₁', 'No public liquidation before intervention resolves (Guaranteed Exclusivity)'],
  ['I₆', 'L1 mutation rejected with Error 3007 while position is delegated (DLP Shield)'],
  ['I₁₀', 'Settlement produces a durable on-chain RescueRecord receipt PDA'],
]

export default function Verify() { 
  return (
    <main className="site-shell console-page">
      <Navbar />
      <div className="page-heading">
        <span className="section-label">JUDGE / REVIEWER VERIFICATION</span>
        <h1>Verify the claim.</h1>
        <p>Rescue is built to be checked in minutes: inspect the program, follow the lifecycle, and compare the anchored receipt.</p>
      </div>
      <section className="verify-grid">
        <div className="verify-card">
          <span className="section-label">DEVNET PROGRAM ID</span>
          <code>{PROTOCOL_CONSTANTS.PROGRAM_ID}</code>
          <a href={`https://explorer.solana.com/address/${PROTOCOL_CONSTANTS.PROGRAM_ID}?cluster=devnet`} target="_blank" rel="noreferrer">
            VIEW DEVNET PROGRAM <ExternalLink size={14} />
          </a>
        </div>
        <div className="verify-card">
          <span className="section-label">QUICK VERIFY</span>
          <ol>
            <li><b>01</b> Clone the repository and inspect the verification harness.</li>
            <li><b>02</b> Observe the DLP delegation and Error 3007 rejection on L1.</li>
            <li><b>03</b> Compare settlement numbers with the RescueRecord PDA.</li>
          </ol>
          <a href="https://github.com/Olalolo22/rescue" target="_blank" rel="noreferrer">
            <GitBranch size={15} /> OPEN REPOSITORY <ExternalLink size={13} />
          </a>
        </div>
      </section>
      <section className="invariant-panel">
        <div>
          <span className="section-label">INVARIANTS SCORECARD</span>
          <h2>Three claims.<br /><em>Three checks.</em></h2>
        </div>
        <div className="invariant-list">
          {checks.map(([id, text]) => (
            <div className="invariant-row" key={id}>
              <span>{id}</span>
              <p>{text}</p>
              <Check />
            </div>
          ))}
        </div>
      </section>
      <div className="console-note">
        <FileCheck2 />
        <span>See the <a href="/proof/rescue-record-rp-0427">receipt inspector</a> for the concrete settlement proof.</span>
      </div>
    </main> 
  )
}
