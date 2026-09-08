import { Check, Copy, ExternalLink, FileCheck2, ShieldCheck } from 'lucide-react'
import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'
import { KNOWN_PDAS } from '@/lib/protocol/pda'
import { Navbar } from '@/components/Navbar'

export default async function Proof({ params }: { params: Promise<{ hash: string }> }) { 
  const { hash } = await params
  const pda = KNOWN_PDAS.RESCUE_RECORD_0427

  return (
    <main className="site-shell console-page">
      <Navbar />
      <div className="page-heading">
        <span className="section-label">RESCUERECORD / RECEIPT INSPECTOR</span>
        <h1>Settlement, anchored.</h1>
        <p>A cryptographic receipt for the intervention outcome. This is the proof surface for judges and integrators.</p>
      </div>
      <section className="receipt-grid">
        <div className="receipt-primary">
          <div className="receipt-seal"><FileCheck2 /></div>
          <span className="eyebrow cyan-eyebrow"><Check /> DEVNET PROOF / SIMULATED SETTLEMENT</span>
          <h2>{hash || PROTOCOL_CONSTANTS.INCIDENT_ID}</h2>
          <p>Rescue intervention committed from MagicBlock ephemeral execution back to Solana L1.</p>
          <a 
            className="primary-button" 
            href={`https://explorer.solana.com/address/${PROTOCOL_CONSTANTS.PROGRAM_ID}?cluster=devnet`} 
            target="_blank" 
            rel="noreferrer"
          >
            OPEN ON SOLANA EXPLORER <ExternalLink size={14} />
          </a>
        </div>
        <div className="receipt-rows">
          <Row label="PUBLIC PENALTY" value="-$72.00 / 8.00%" />
          <Row label="WINNING PENALTY" value="-$22.50 / 2.50%" green />
          <Row label="BORROWER SURPLUS SAVED" value="+$49.50 (+5.50%)" green />
          <Row label="L1 SLOT" value="284,719,445" />
          <Row label="TEE EXECUTION" value="FINALIZED" green />
          <Row label="INVARIANTS" value="I₁ · I₆ · I₁₀ VERIFIED" green />
        </div>
      </section>
      <section className="proof-hash">
        <span>RESCUERECORD PDA</span>
        <code>{pda}</code>
      </section>
    </main> 
  )
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) { 
  return (
    <div className="receipt-row">
      <span>{label}</span>
      <strong className={green ? 'green-text' : ''}>{value}</strong>
    </div> 
  )
}

