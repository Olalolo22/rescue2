import { Check, CircleAlert, LockKeyhole, Radio, ShieldCheck } from 'lucide-react'
import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'
import { Navbar } from '@/components/Navbar'

const events = [
  ['09:42:18.004', 'DELEGATION_COMMITTED', `Position ${PROTOCOL_CONSTANTS.INCIDENT_ID} transferred to MagicBlock TEE ER`, 'confirmed'],
  ['09:42:18.119', 'MEV_MUTATION_REJECTED', 'Error 3007: AccountOwnedByWrongProgram on Solana L1 (DLP locked)', 'rejected'],
  ['09:42:19.772', 'BIDS_COMMITTED', 'Three sealed reverse auction bids locked inside enclave', 'confirmed'],
  ['09:42:34.201', 'WINNER_MATCHED', 'Lowest valid penalty selected: Rescuer B at 2.50% (Borrower saved +$49.50)', 'confirmed'],
  ['09:42:36.098', 'SETTLEMENT_FINALIZED', 'RescueRecord PDA anchored on Solana Devnet', 'confirmed'],
]

export default function Activity() { 
  return (
    <main className="site-shell console-page">
      <Navbar />
      <div className="page-heading">
        <span className="section-label">LIVE PROTOCOL ACTIVITY</span>
        <h1>Evidence, not theater.</h1>
        <p>Every transition in the intervention lifecycle resolves into a state a judge can inspect.</p>
      </div>
      <section className="activity-shell">
        <div className="activity-head">
          <span><i className="telemetry-dot" /> STREAMING / DEVNET</span>
          <span>INCIDENT {PROTOCOL_CONSTANTS.INCIDENT_ID}</span>
        </div>
        {events.map(([time, title, copy, state], index) => (
          <article className="activity-event" key={title}>
            <div className="event-time">{time}</div>
            <div className={`event-marker ${state}`}>
              {state === 'rejected' ? <CircleAlert /> : index === 4 ? <ShieldCheck /> : <Check />}
            </div>
            <div>
              <div className="event-title">{title}</div>
              <p>{copy}</p>
            </div>
            <span className={`event-state ${state}`}>
              {state === 'rejected' ? 'REJECTED (3007)' : 'VERIFIED'}
            </span>
          </article>
        ))}
      </section>
      <div className="console-note">
        <LockKeyhole />
        <span>Activity is a presentation of the Rescue protocol lifecycle. Verify the anchored receipt independently on the <a href="/verify">verification surface</a>.</span>
      </div>
    </main> 
  )
}
