# Rescue V1 — Technical Architecture & Invariants

> **Status:** Pre-implementation. Every claim is labeled.
> **Labels:**
> - `[VERIFIED]` — Confirmed from code (BlitzMine, Tenor), MagicBlock TG team, or Solana runtime spec.
> - `[ASSUMED]` — Reasonable inference from docs/patterns; not yet live-tested.
> - `[TO VERIFY]` — Must be confirmed before writing code that depends on it.
> - `[DEMO-ONLY]` — Acceptable for a hackathon demo; not production-safe.

---

## 0. Purpose of This Document

We build Rescue in exactly two phases:
1. **Architecture attack:** Every dangerous claim identified, labeled, and stress-tested before a line of code is written.
2. **Implementation:** Only after the architecture survives the attack.

This document is Phase 1. Do not write program code until every `[TO VERIFY]` item is resolved or explicitly downgraded to `[DEMO-ONLY]` with documented tradeoffs.

---

## 1. Product Primitive

**Rescue** is an ephemeral restructuring layer that inserts a temporary, private, competitive market between a DeFi lending position's deteriorating state and its liquidation transition.

DeFi today:
```
HEALTHY → UNHEALTHY → LIQUIDATION (permissionless MEV race)
```

Rescue inserts:
```
HEALTHY → AT_RISK → INTERVENTION_ZONE (temporary private restructuring market)
                         |                        |
                      RESCUED             TIMEOUT/UNRESOLVED
                     (back to             |
                      HEALTHY)        LIQUIDATABLE
                                      (standard liquidation)
```

**The core invariant [ASSUMED; must not be violated]:**
> Rescue can delay the liquidation transition only while the position is inside the Rescue protocol's authorized state machine. It CANNOT create a permanent escape from liquidation. The timeout path MUST always resolve to LIQUIDATABLE within a fixed time bound.

**The MagicBlock necessity test [VERIFIED from Blitz 7 pattern]:**
Remove MagicBlock: replace with centralized server (custody/censorship risk) + trusted auctioneer + opaque database + manual L1 settlement. The thing changes ontologically: you have built a TradFi OTC desk, not a trustless market primitive.

**What Rescue does NOT build [VERIFIED from Aegis lesson + Blitz 7 winner analysis]:**
- Interest accrual math
- Borrow market accounting
- Collateral pricing models
- Oracle infrastructure (uses Pyth directly)
- Liquidation penalty calculation

**What Rescue owns:**
- The position state machine (HEALTHY -> AT_RISK -> INTERVENTION_ZONE -> RESCUED/LIQUIDATABLE)
- The bid lifecycle inside PER
- The settlement protocol back to L1
- The timeout/escape hatch
- The MEV exclusion window

---

## 2. Threat Model

### Actors

| Actor | Trust Level | Can Do |
|---|---|---|
| **Borrower** | Owner of their position PDA | Open position, add collateral, authorize auto-rescue params |
| **Capital Providers (Lenders)** | Permissioned ER participants | Submit sealed bids inside PER |
| **Keeper (Crank)** | Untrusted; anyone can call | Initiate rescue window when oracle conditions are met |
| **MEV Searcher** | Hostile | Tries to liquidate, front-run bids, grief the rescue window |
| **MagicBlock ER Validator** | Semi-trusted (TEE) | Executes PER instructions; cannot read encrypted TEE state `[TO VERIFY: exact TEE attestation model]` |
| **MagicBlock ER Operator** | Semi-trusted | Could see ER local ledger state (non-TEE accounts); cannot see PER/TEE state `[VERIFIED from TG core team]` |
| **Pyth Oracle** | Trusted data source | Provides live asset prices |

### Primary Attack Surfaces

1. **Liquidation race before rescue window activates:** Keeper must detect and delegate fast enough that HF does not hit liquidation boundary before ER is live. `[TO VERIFY: keeper latency vs Pyth feed update frequency]`
2. **Bid leakage via cross-read:** Competing lenders must not see each other's bids inside PER. Enforced by TEE hardware + program-level CrossReadDenied errors. `[VERIFIED: Tenor built this with error 6013]`
3. **MEV bot calling liquidation during INTERVENTION_ZONE:** The rescue window exclusivity mechanism must prevent this. `[TO VERIFY: exact mechanism — see Section 5]`
4. **Settlement deadlock / account stranded in DLP:** ER commit can lag on public TEE. Must have deterministic escape path. `[VERIFIED: Tenor documented this bug; see Section 10]`
5. **Timeout bypass:** Malicious lender submitting a winning bid that can never be executed, keeping position in INTERVENTION_ZONE forever. Fixed by hard on-chain deadline. `[ASSUMED]`

---

## 3. System Boundaries Diagram

```
+---------------------------------------------------------------------------+
|                        Solana Base Layer (L1)                             |
|                                                                           |
|  +--------------------------------------------------------------------+  |
|  |            Rescue Reference Lending Host Program                    |  |
|  |  PositionPDA   CollateralVaultPDA   RescueConfigPDA               |  |
|  |  (owned by Rescue program on L1; delegated to ER on rescue)        |  |
|  +--------------------------------------------------------------------+  |
|                                                                           |
|  +--------------------+   +-------------------------------------+        |
|  |  Pyth Oracle       |   |  User/Wallet (Borrower)             |        |
|  |  PriceUpdateV2     |   |  Capital Providers (Lenders)        |        |
|  +--------------------+   +-------------------------------------+        |
+-----------------------------------+---------------------------------------+
                                    | Delegation CPI (account freeze on L1)
                                    v
+---------------------------------------------------------------------------+
|                 MagicBlock Ephemeral Rollup (ER)                          |
|                 Sub-millisecond SVM, local ledger                         |
|                                                                           |
|  +---------------------------------------------------------------------+  |
|  |       MagicBlock Private ER (PER / TEE -- Intel TDX)               |  |
|  |                                                                     |  |
|  |   LenderBidPDA_1 (sealed)    LenderBidPDA_2 (sealed)              |  |
|  |   LenderBidPDA_3 (sealed)    AuctionStatePDA                       |  |
|  |                                                                     |  |
|  |   [Private to each lender; CrossReadDenied (6013) on others]       |  |
|  +---------------------------------------------------------------------+  |
|                                                                           |
|  PositionPDA (delegated)   CollateralVaultPDA (delegated)               |
|  Cranks: Oracle reader, Auction timeout enforcer                         |
+-----------------------------------+---------------------------------------+
                                    | commit_and_undelegate CPI
                                    | (ER -> L1; Magic Actions optional)
                                    v
+---------------------------------------------------------------------------+
|                 Settlement on Solana L1                                   |
|  finalize_rescue: write RescueRecord PDA, transfer capital               |
|  OR finalize_liquidation: mark LIQUIDATABLE, emit event to bots          |
+---------------------------------------------------------------------------+
```

---

## 4. On-Chain State Machine

### States

```
HEALTHY
  Condition:  health_factor > rescue_threshold
  Authority:  Borrower (full control)
  L1 Status:  Normal program-owned PDAs

AT_RISK
  Condition:  liquidation_threshold < health_factor <= rescue_threshold
  Authority:  Borrower (still full control; can add collateral/repay)
  L1 Status:  PDAs still on L1; keeper permitted to initiate rescue

INTERVENTION_ZONE
  Condition:  Keeper has called initiate_rescue; PositionPDA delegated to ER
  Authority:  ER owns PositionPDA; L1 liquidation calls BLOCKED [see Section 5]
  ER Status:  Auction active; lenders submitting sealed bids

RESCUE_ACTIVE
  Sub-state of INTERVENTION_ZONE after matching finds a winning bid
  Condition:  Winner selected inside PER; awaiting commit to L1
  Authority:  ER; undelegate + finalize in progress

RESCUED
  Condition:  finalize_rescue executed on L1; position restored to health
  Authority:  Borrower regains full control
  L1 Status:  All PDAs returned to normal program ownership
  Invariant:  health_factor > rescue_threshold after rescue

TIMEOUT / UNRESOLVED
  Condition:  Intervention window expired (deadline_ts exceeded) with no winner
              OR winner selected but ER settlement failed after retries
  Authority:  Transitional; rescue program calls finalize_liquidation
  L1 Status:  PDAs returned to L1; position marked LIQUIDATABLE

LIQUIDATABLE
  Condition:  TIMEOUT path; health_factor at or below liquidation boundary
  Authority:  Permissionless; standard liquidation bots can now call liquidate()
  L1 Status:  Full standard L1 access; rescue window closed permanently for this event
```

### Transitions

```
HEALTHY -> AT_RISK:
  Trigger: Pyth oracle price feed causes health_factor to cross rescue_threshold
  Who: Anyone observing Pyth feed; keeper detects and flags position
  On-chain action: [ASSUMED] Keeper calls flag_at_risk(position_pda)

AT_RISK -> INTERVENTION_ZONE:
  Trigger: Keeper calls initiate_rescue(position_pda) while still AT_RISK
  On-chain action: Delegate PositionPDA + CollateralVaultPDA to ER via delegation CPI
  Requirement: health_factor MUST be > liquidation_threshold at time of delegation
               [TO VERIFY: exact timing guarantee; race condition if price moves fast]

INTERVENTION_ZONE -> RESCUE_ACTIVE:
  Trigger: Auction matching inside PER finds a winning restructuring bid
  On-chain action: ER match instruction sets AuctionState.winner; schedules commit

RESCUE_ACTIVE -> RESCUED:
  Trigger: finalize_rescue executes on L1 after ownership returns to program
  On-chain action: Capital injected; collateral rebalanced; state -> HEALTHY

INTERVENTION_ZONE -> TIMEOUT:
  Trigger: deadline_ts exceeded with no winner
  On-chain action: Keeper (or anyone) calls timeout_rescue; ER undelegates; state -> LIQUIDATABLE

RESCUE_ACTIVE -> TIMEOUT (settlement failure):
  Trigger: finalize_rescue retries exhausted (see Section 11)
  On-chain action: Fallback finalize_liquidation; state -> LIQUIDATABLE

AT_RISK -> HEALTHY (self-rescue):
  Trigger: Borrower repays debt or adds collateral directly
  On-chain action: Standard repay/collateral instruction; no ER involvement
```

---

## 5. Account / PDA Ownership Map

> This is the most critical section. Every account tracked for its entire lifecycle.

### PositionPDA

| Phase | Owner | Can Mutate | Notes |
|---|---|---|---|
| HEALTHY / AT_RISK | Rescue program (L1) | Borrower (via signed ix) | Normal L1 state |
| INTERVENTION_ZONE | MagicBlock Delegation Program (DELeGG...) | ER cranks only | `[VERIFIED: standard MagicBlock delegation model]` |
| RESCUE_ACTIVE | MagicBlock Delegation Program | ER match instruction | Transitioning to L1 |
| RESCUED / LIQUIDATABLE | Rescue program (L1) | Borrower or liquidator | Ownership returned post-undelegate |
| If ER disappears mid-session | Stranded in DLP | Nobody until MagicBlock recovery | `[VERIFIED: Tenor experienced this; handled by ownership-poll + finalize]` |
| If settlement fails | Rescue program (after CPI undelegate) | Rescue program calls finalize | Escape hatch mandatory |

### CollateralVaultPDA

| Phase | Owner | Notes |
|---|---|---|
| HEALTHY / AT_RISK | Rescue program (L1) | Holds borrower's collateral tokens |
| INTERVENTION_ZONE | MagicBlock Delegation Program | Frozen; no L1 transfers possible `[ASSUMED: same as PositionPDA]` |
| Post-rescue | Rescue program | Rebalanced by finalize_rescue |
| Post-liquidation | Rescue program | Available to liquidator |

### LenderBidPDA (N per lender)

| Phase | Owner | Notes |
|---|---|---|
| Creation | ER PER (Private TEE) -- ephemeral account | Never touches L1; created inside ER `[ASSUMED: using close_ephemeral_*]` |
| During auction | PER / TEE | CrossReadDenied to other lenders `[VERIFIED: Tenor pattern error 6013]` |
| After resolution | Closed on ER; rent returned | Losing bids never written to L1 `[ASSUMED]` |

### AuctionStatePDA

| Phase | Owner | Notes |
|---|---|---|
| INTERVENTION_ZONE | ER (delegated or ephemeral) | Tracks window deadline, bid count, winner field |
| Post-resolution | L1 (committed) | Contains winner pubkey, terms for finalize_rescue |

### RescueRecordPDA (created on success)

| Phase | Notes |
|---|---|
| Created by finalize_rescue on L1 | Immutable audit record |
| Contains | Winner, rescue terms, original position snapshot, timestamp |

### Who Blocks L1 Liquidation During INTERVENTION_ZONE?

`[TO VERIFY — MOST CRITICAL ITEM IN ENTIRE DOCUMENT]`

- **Approach A (Reference Implementation):** The Rescue host program's own `liquidate()` instruction has a guard: `require!(position.state != PositionState::InterventionZone, RescueError::PositionInRescueWindow)`. We own the program; we control this check. `[ASSUMED: works for reference implementation]`
- **Approach B (PositionPDA Delegation):** While PositionPDA is delegated (DLP-owned on L1), any instruction requiring `position` as a writable account fails with `AccountOwnedByWrongProgram (3007)`. `[VERIFIED: Tenor experienced this as a bug; for us it is a feature]`
- **Approach C (Third-party Marginfi/Kamino):** CANNOT work without protocol modification. `[VERIFIED from Solana runtime: third-party programs own their accounts; we cannot delegate them]`

**Design decision:** Build reference implementation where PositionPDA delegation IS the liquidation lock. Test the 3007 error path explicitly in the test suite.

---

## 6. ER / PER Delegation Lifecycle

### Delegation (L1 -> ER)

```
1. Rescue program calls delegation CPI on PositionPDA + CollateralVaultPDA
   - Anchor: #[account(mut, del, seeds = [SEED_POSITION, borrower.key().as_ref()], bump)]
   - DelegateConfig: { validator: Some(MAGICBLOCK_ER_VALIDATOR_PUBKEY), ..Default::default() }
   [VERIFIED: BlitzMine and Tenor both use this pattern]

2. MagicBlock Delegation Program (DELeGG...) takes ownership on L1
   - PositionPDA.owner -> DELeGG... (frozen on L1)
   [VERIFIED from Solana runtime]

3. ER begins accepting transactions modifying PositionPDA
   - Sub-millisecond execution of auction cranks
   [VERIFIED from MagicBlock docs]
```

### PER (Private TEE) Setup for Lender Bids

```
4. For each registered lender, init_bid_permission(lender_pubkey, matcher_pubkey)
   - Creates EphemeralPermission account granting lender write access to their LenderBidPDA
   - Grant matcher read access for auction resolution
   [TO VERIFY: multi-member EphemeralPermission sizing bug (Tenor documented this)]
   [TO VERIFY: must prefund permission account at size_of(2) if 2 members needed]

5. Each lender calls update_bid(bid_params) signed with session key inside TEE
   - LenderBidPDA is private; CrossReadDenied (6013) enforced by program check
   [VERIFIED: Tenor built and proved this]
```

### Resolution (ER -> L1)

```
6. Auction window closes (deadline_ts reached or keeper calls close_window)
   - close_window sets AuctionState.phase = Matching

7. match_and_settle instruction runs on ER (NO Magic Actions bundled)
   [VERIFIED CRITICAL: Tenor proved bundling Magic Actions with match fails on public TEE]
   - Selects winner based on bid quality (see Section 9)
   - Sets AuctionState.winner and AuctionState.terms
   - Does NOT attempt token transfers in this instruction

8. Program CPI undelegate (NOT client SDK createCommitAndUndelegateInstruction)
   [VERIFIED: Tenor proved client SDK commit IX often fails; program CPI is reliable]

9. Client polls Solana L1 for account owner != DELeGG...
   await waitForProgramOwnership(connection, positionPda, RESCUE_PROGRAM_ID)
   [VERIFIED: Tenor's ownership-poll pattern; GetCommitmentSignature API unreliable]

10. finalize_rescue (or finalize_liquidation) called on L1
    - Reads AuctionState.winner from now-committed account
    - Executes capital injection, position update, emits RescueRecord
    [ASSUMED: standard base-layer finalize pattern from Tenor]
```

---

## 7. Oracle Model

- **Feed:** Protocol-specific price feed for collateral asset (e.g. SOL/USD)
- **Devnet:** Pyth Hermes -> Pyth Solana Receiver -> on-chain PriceUpdateV2 account
- **MAX_PRICE_AGE_SECONDS:** 600 for devnet demos (avoids ER clock skew) `[VERIFIED: Tenor used same constant for same reason]`
- **ER readability:** Pyth PriceUpdateV2 must be readable from ER `[VERIFIED: Tenor ran oracle:er probe; we must reproduce]`

### Health Factor Formula

```
health_factor = (collateral_value * liquidation_threshold_weight) / borrowed_value
rescue_threshold = liquidation_threshold + rescue_buffer
intervention_zone = [liquidation_threshold, rescue_threshold]
```

`[ASSUMED: exact formula; must be locked before coding]`

### Oracle Failure During INTERVENTION_ZONE `[TO VERIFY]`

If Pyth feed is stale:
- Option A: Continue using last valid price (risky)
- Option B: Trigger timeout/cancel if price age exceeds MAX_PRICE_AGE_SECONDS (safer)
- **Decision required before implementation.**

---

## 8. Private Bid Model

### Bid Structure

```rust
// [ASSUMED: exact fields TBD]
pub struct LenderBid {
    pub lender: Pubkey,
    pub rescue_amount: u64,        // Capital offered
    pub required_rate_bps: u16,    // Annualized restructuring fee in bps
    pub min_collateral_price: i64, // Conditional: only valid if price >= this
    pub max_ltv_post_rescue: u16,  // Conditional: lender's max acceptable LTV
    pub expiry_slot: u64,          // Bid auto-expires if ER slot exceeds this
    pub version: u8,               // For bid updates
}
```

### Bid Confidentiality

- Each lender's `LenderBidPDA` initialized inside PER (TEE) `[ASSUMED]`
- Program enforces `CrossReadDenied` when signer is not lender or authorized matcher `[VERIFIED: Tenor pattern]`
- Losing bids never committed to L1 `[ASSUMED: closed via close_ephemeral_account before commit]`

### Bid Lifecycle

```
Lender funds rescue liquidity pool on L1 (pre-registration)
  -> Lender receives session key for ER interactions [ASSUMED]
  -> INTERVENTION_ZONE opens -> Lender calls submit_bid() inside PER
  -> Lender can call update_bid() (versioned; only bidder can update own bid)
  -> close_window called -> no new bids accepted
  -> Matching selects winner
  -> Winner's bid params -> AuctionState.terms (committed to L1)
  -> Loser bids -> closed on ER, never touch L1
```

---

## 9. Matching Algorithm

### Selection Criteria `[ASSUMED: open design decision]`

```
score(bid) = rescue_amount / required_rate_bps
             where bid.min_collateral_price <= current_pyth_price
             AND bid.max_ltv_post_rescue >= projected_ltv
             AND bid.expiry_slot >= current_slot
```

Highest score wins. Ties broken by: `sha256(slot || auction_id || lender_pubkeys) % n` (domain-separated rejection sampling) `[VERIFIED: BlitzMine used this approach]`

If no bid satisfies conditions at close_window -> AuctionState.winner = None -> timeout path.

---

## 10. Settlement Protocol

### Happy Path

```
ER: close_window -> match_and_settle (match-only, NO magic actions)
ER: undelegate_position CPI (program CPI, not client SDK)     [VERIFIED]
L1: poll until PositionPDA.owner == RESCUE_PROGRAM_ID         [VERIFIED]
L1: finalize_rescue(position_pda, auction_state_pda)
    - Transfer rescue_amount from winner's vault -> CollateralVault
    - Update PositionPDA: state = RESCUED, health_factor recalculated
    - Write RescueRecordPDA: winner, terms, timestamp
    - Emit RescuedEvent
```

### Settlement Failure Path `[ASSUMED]`

```
ER: undelegate_position CPI sent
L1: poll timeout -- ownership does not return within OWNERSHIP_POLL_TIMEOUT_MS
    -> Retry CPI undelegate (max N_RETRIES)
    -> If still DLP-owned: emit StrandedPositionAlert
    -> Emergency: finalize_liquidation called (marks LIQUIDATABLE, opens to bots)
```

`[TO VERIFY: guaranteed maximum time for ownership return after program CPI undelegate on public TEE? Tenor observed <2s in clean probes]`

### Base Fallback (No TEE / ER Unavailable) `[DEMO-ONLY]`

```
match_and_settle_crank: runs entirely on L1 without ER
- Uses init_public_bid instead of PER private bids
- Privacy property is lost; positions settle correctly
- Document: "Privacy only guaranteed when PER/TEE is available"
```

---

## 11. Timeout / Failure Handling

### Core Anti-Deadlock Invariant

```
deadline_ts = initiate_rescue_timestamp + RESCUE_WINDOW_DURATION

RESCUE_WINDOW_DURATION [TO VERIFY: minimum window covering TEE setup + bids + match + undelegate + finalize]
Tenor measured: p50 = 7205ms, p95 = 7330ms for their flow.
Recommend starting at 120 seconds (Tenor's WINDOW_DURATION_SECONDS = 120).
```

### Timeout Trigger

Anyone can call `timeout_rescue(position_pda)` once `clock.unix_timestamp >= deadline_ts` AND position is still INTERVENTION_ZONE. Idempotent and permissionless. `[ASSUMED]`

**Issue:** If position is still DLP-owned (stranded), `timeout_rescue` mutating PositionPDA would fail with `AccountOwnedByWrongProgram (3007)`. `[TO VERIFY: need escape hatch for stranded DLP positions]`

**Proposed escape hatch:**
1. `emergency_undelegate` CPI that admin can call to force ownership return.
2. Once ownership returns, call `finalize_liquidation` -> marks LIQUIDATABLE.

### VRF Timeout (if used for tie-breaking)

- VRF timeout = 30 seconds `[VERIFIED: BlitzMine used 30s cancel_round]`
- If VRF stalls -> cancel auction -> position returns to AT_RISK or directly LIQUIDATABLE if HF < threshold

---

## 12. MEV Model

### What an L1 MEV Searcher Can Observe

| Data | Visibility | Notes |
|---|---|---|
| PositionPDA.state = INTERVENTION_ZONE | PUBLIC | Searcher knows rescue is in progress |
| Which lenders are bidding | HIDDEN inside PER TEE | Cannot enumerate bidders |
| Individual bid amounts / rates | HIDDEN inside PER TEE | CrossReadDenied (6013) `[VERIFIED]` |
| Whether winner has been selected | HIDDEN until finalize commits | |
| Winning terms after finalize | PUBLIC on L1 (RescueRecordPDA) | Audit trail after the fact |
| Whether to call liquidate() | BLOCKED while PositionPDA is DLP-owned | 3007 AccountOwnedByWrongProgram |

### MEV Attack Console (Demo Feature)

`[DEMO-ONLY: simulated for hackathon; real devnet transactions]`

1. Bot watches for PositionPDA owner change -> DELeGG... (detects rescue).
2. Bot attempts to call `rescue_program::liquidate(position_pda)`.
3. Transaction fails: `RescueError::PositionInRescueWindow` OR `AccountOwnedByWrongProgram (3007)`.
4. UI shows: "MEV Bot Blocked -- position is under Rescue protocol"
5. After finalize_rescue: if rescued, bot sees RESCUED. If timeout, bot can call liquidate() on LIQUIDATABLE position.

This demonstrates both the exclusivity property (during rescue) and the no-permanent-escape guarantee (after timeout).

---

## 13. Reference Lending Host

### Why We Build Our Own

`[VERIFIED from Blitz 7 analysis: BlitzMine (1st) and Tenor (2nd) both built self-contained programs. Neither wrapped external protocols. This is the winning pattern.]`

The reference host is:
> "The smallest host protocol necessary to demonstrate the Rescue primitive."

It is NOT a production lending protocol.

### Minimal Position Struct

```rust
// [ASSUMED: exact fields will evolve]
pub struct Position {
    pub borrower: Pubkey,
    pub collateral_token: Pubkey,
    pub collateral_amount: u64,
    pub borrowed_amount: u64,
    pub health_factor: u64,             // basis points (10000 = 1.0)
    pub liquidation_threshold_bps: u16,
    pub rescue_threshold_bps: u16,
    pub state: PositionState,
    pub rescue_deadline_ts: i64,
    pub bump: u8,
}

pub enum PositionState {
    Healthy,
    AtRisk,
    InterventionZone,
    Rescued,
    Liquidatable,
}
```

### Instructions

| Instruction | Runs On | Auth | Notes |
|---|---|---|---|
| `open_position` | L1 | Borrower | Creates PositionPDA + CollateralVaultPDA |
| `deposit_collateral` | L1 | Borrower | Transfers tokens into CollateralVaultPDA |
| `borrow` | L1 | Borrower | Issues debt; updates health_factor |
| `repay` | L1 | Borrower | Reduces debt; can restore HEALTHY |
| `flag_at_risk` | L1 | Permissionless (keeper) | Sets state = AtRisk if oracle conditions met |
| `initiate_rescue` | L1 | Permissionless (keeper) | Delegates PositionPDA + CollateralVaultPDA to ER |
| `liquidate` | L1 | Permissionless | BLOCKED when state = InterventionZone |
| `timeout_rescue` | L1 | Permissionless | Can call when deadline_ts expired |
| `finalize_rescue` | L1 | Permissionless | After undelegate; reads AuctionState winner |
| `finalize_liquidation` | L1 | Permissionless | On timeout path; marks LIQUIDATABLE |

---

## 14. Future Marginfi / Kamino Adapter RFC

This is the long-term product story, NOT the hackathon deliverable.

```
Existing Lending Protocol
        |
        | position.health_factor enters rescue_threshold
        v
   RescueAdapter (separate program / hook)
        |
        | calls delegate(position_authority) via CPI
        v
 MagicBlock PER / ER
        |
        |-- sealed lender bids (TEE)
        |-- live Pyth oracle state
        |-- matching engine
        |-- winner selection
        |
        v
    Settlement (finalize_rescue CPI back into lending protocol)
        |
        v
 Existing Lending Protocol (position modified: debt repaid / collateral rebalanced)
```

**Why this requires protocol modification `[VERIFIED]`:** To delegate MarginfiAccount to MagicBlock ER, the Marginfi program itself must invoke the delegation CPI. A third-party program cannot delegate accounts it does not own.

- V1: Reference implementation (we own the program)
- V1.5: Work with Marginfi/Kamino to add a Rescue hook
- V2: Native Rescue integration; Delegation IS the liquidation lock on L1

---

## 15. MagicBlock-Specific Dependencies

### SDK / Toolchain `[VERIFIED from Tenor Anchor.toml + BlitzMine]`

```toml
[toolchain]
anchor_version = "1.0.2"    # Tenor used this; align for compatibility
solana_version = "3.1.9"    # Tenor used Agave 3.1.9

[dependencies]
ephemeral-rollups-sdk = { git = "https://github.com/magicblock-labs/ephemeral-rollups-sdk" }
```

### MagicBlock ER Endpoints `[VERIFIED from Tenor source]`

```
Public ER devnet:   https://devnet.magicblock.app
TEE/PER devnet:     https://devnet-tee.magicblock.app
TEE validator key:  MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo
```

Always verify validator identity with `getIdentity` RPC before delegating. Do NOT use `FnE6VJT5...` (old key).

---

## 16. Known Assumptions Requiring Verification

Ordered by risk level (highest first):

| # | Assumption | Risk if Wrong | How to Verify |
|---|---|---|---|
| 1 | EphemeralPermission multi-member bug fixed on current TEE | PER bid privacy broken | Run Tenor's permission test + probe_cross_read against live TEE |
| 2 | After program CPI undelegate, ownership returns within 2-30s on public TEE | Settlement deadlock | Run ownership poll probe against live TEE |
| 3 | timeout_rescue can be called while PositionPDA is DLP-owned | Anti-deadlock invariant broken | Deploy test program; attempt mutation of delegated account from base |
| 4 | Pyth PriceUpdateV2 readable from inside TEE ER | Oracle model fails | oracle:er equivalent test |
| 5 | Keeper can initiate rescue fast enough before HF hits liquidation boundary | Race condition; position liquidated before rescue active | Measure Pyth feed frequency vs delegation latency |
| 6 | 3007 AccountOwnedByWrongProgram fires reliably on liquidate() call for a delegated PositionPDA | MEV exclusivity broken | Deploy test; call liquidate on delegated account |
| 7 | close_ephemeral_account cleans up LenderBidPDA on ER without leaving state on L1 | Privacy claim weakened | Check ephemeral_rollups_sdk for close_ephemeral_* API |

---

## 17. Demo Architecture

### Live Demo Flow

```
1.  Open Rescue UI in browser (deployed Railway/Vercel)
2.  Connect wallet (Privy or Phantom)
3.  Open a demo lending position (SOL collateral, USDC debt)
4.  [Simulation] Price oracle drops 8% via UI control
5.  UI shows: position enters AT_RISK (health factor counter animation)
6.  Keeper auto-detects -> calls initiate_rescue
7.  UI shows: "RESCUE WINDOW ACTIVE" + countdown timer
8.  3 simulated lender bots submit sealed bids (visible as bid count only, not amounts)
9.  [MEV Attack Console] Bot attempts liquidate() -> shows 3007 error
10. Matching selects winner (best restructuring terms)
11. Settlement: CPI undelegate -> finalize_rescue
12. UI shows: "POSITION RESCUED" + RescueRecord on Solana Explorer
13. [Attack Console] Bot now allowed to call liquidate() on a LIQUIDATABLE position -> shows success
```

### Backend Requirements

- NestJS crank (modeled on BlitzMine): keeper polling Pyth, initiating rescues, triggering timeouts `[ASSUMED]`
- WebSocket gateway for live UI state updates `[ASSUMED]`
- Deployed to Railway `[DEMO-ONLY]`

---

## 18. Implementation Milestones

> Do NOT start any milestone until all [TO VERIFY] items in the preceding milestone are resolved.

### Milestone 0: Verification Sprint (Before Any Program Code)

- [ ] Deploy a test Anchor program to devnet with a single delegated account
- [ ] Prove: program CPI undelegate -> ownership returns to program on L1 within 30s
- [ ] Prove: bot calling mutation on delegated account gets AccountOwnedByWrongProgram (3007)
- [ ] Prove: Pyth price feed readable from TEE ER (oracle:er equivalent)
- [ ] Prove: EphemeralPermission with 2 members works on current TEE build
- [ ] Resolve: Can timeout_rescue be called while account is DLP-owned?

### Milestone 1: Reference Host Program + State Machine (Days 1-2)

- [ ] open_position, deposit_collateral, borrow, repay
- [ ] flag_at_risk (oracle-gated keeper instruction)
- [ ] liquidate with InterventionZone guard
- [ ] initiate_rescue with delegation CPI
- [ ] Unit tests for all state transitions

### Milestone 2: ER Auction Engine (Days 2-3)

- [ ] init_bid_permission, submit_bid, update_bid inside PER
- [ ] close_window, match_and_settle (match-only, no Magic Actions)
- [ ] probe_cross_read (returns 6013) -- demo asset
- [ ] Hash-based or VRF tie-breaking

### Milestone 3: Settlement Protocol (Days 3-4)

- [ ] undelegate_position (program CPI)
- [ ] finalize_rescue + finalize_liquidation
- [ ] Ownership-poll helper in TS client
- [ ] timeout_rescue with escape hatch
- [ ] match_and_settle_crank (base fallback without ER) [DEMO-ONLY]

### Milestone 4: Keeper Backend + MEV Console (Days 4-5)

- [ ] NestJS crank: Pyth watcher -> flag_at_risk -> initiate_rescue
- [ ] WebSocket gateway for UI state sync
- [ ] MEV Attack Console (bot simulation, real devnet transactions)
- [ ] RescueRecord indexer + Explorer link

### Milestone 5: Frontend + Polish (Days 5-7)

- [ ] Rescue UI: position health dashboard, countdown, bid count, attack console
- [ ] Deploy to Railway
- [ ] 60-second demo video recording
- [ ] README + submission doc

---

## 19. Document Attack Instructions

When this document is shared with GPT or any reviewer, their job is to attack every [ASSUMED] and [TO VERIFY] item:

1. **Find any assumption where "wrong" = permanent asset loss for a borrower.** Those are P0.
2. **Find any settlement path that can create an infinite loop or deadlock.** Those are P0.
3. **Find any PER/TEE assumption contradicted by Tenor's documented bugs.** Those need a fallback.
4. **Find any place where we claim MagicBlock does something the core team has not explicitly confirmed.** Flag it.

Any claim not labeled [VERIFIED] is a liability until Milestone 0 verification probes are run.

---

## 20. Architecture Attack Final Verdict

> **Status:** Architecture attack COMPLETE. Milestone 0 verification probes ran 7/7 green on live devnet.
> This section records the final settled invariant classification agreed upon after multi-round adversarial review (Grok + ChatGPT). No new mechanisms are permitted without restarting this section.

---

### Protocol Identity (Settled)

Rescue is an **Ephemeral Competitive Liquidation-Intervention Layer**.

It is NOT:
- A multi-period debt restructuring facility (no junior notes, no maturity extensions)
- A Chapter 11 analogue (no creditor committees, no court stay)
- A guarantee of competitive auction outcomes

It IS:
- A 60-second sealed-bid reverse auction on the liquidation penalty
- A mechanism guaranteeing the borrower is **never worse off** than public liquidation
- An MEV exclusivity window enforced by Solana's account-ownership runtime invariant
- A fail-open system that always resolves to standard liquidation if the private market fails

---

### 🔒 Proven Invariants (Implementation Must Not Violate)

| # | Invariant | Enforcement |
|:---:|---|---|
| **I1** | **Non-Worseness:** Rescue outcome ≤ public liquidation penalty in every reachable state | Hard cap: `P_reserve = P_public - 150 bps`. Auction reverts if no bid ≤ P_reserve. |
| **I2** | **Minimal Right-Sizing:** Only the exact minimum debt to reach HF ≥ 1.20 is repaid | Deterministic closed form: `R_min = ceil((HF* × D0 - C0 × p × LT) / (HF* - (1+P) × LT))` |
| **I3** | **Anti-Phantom:** All bids are backed by real capital commitment | Session key linked to L1 slashing bond = `max(100 USDC, R_min × 2%)` |
| **I4** | **Atomic Settlement:** Repayment and collateral transfer are a single atomic L1 transaction | `finalize_rescue` validates delivery before releasing collateral; source of capital is irrelevant to protocol |
| **I5** | **One-Way Terminal States:** Timed-out positions never re-enter INTERVENTION_ZONE | `require!(position.state != Liquidatable, RescueError::TerminalState)` |
| **I6** | **Post-Rescue Cooldown:** Successfully rescued positions cannot re-enter for 7,200 slots (~1hr) | `require!(clock.slot >= position.last_rescue_slot + COOLDOWN_SLOTS)` |
| **I7** | **Deterministic Eviction:** `finalize_rescue` and `force_evict` operate on disjoint slot intervals | `finalize`: valid if `slot < hard_cutoff_slot`. `force_evict`: valid if `slot >= hard_cutoff_slot`. |
| **I8** | **Oracle Drift Guard:** Price drift between TEE match and L1 finalize is bounded | Abort if `p_L1 / p_match < 98.5%`. Always re-check `HF >= 1.20` with live L1 Pyth price on finalize. |
| **I9** | **Fail-Open Liveness:** MagicBlock unavailability cannot strand positions permanently | After `eviction_ts`, `force_evict` callable by anyone on L1; position → LIQUIDATABLE. |
| **I10** | **MEV Exclusion:** Base layer liquidation is blocked while PositionPDA is delegated | Solana account-ownership runtime invariant: Error 3007 on all instructions expecting `PositionPDA.owner == RESCUE_PROGRAM_ID`. `[VERIFIED: Probe 03 & 06]` |

---

### 🟡 Parameterized Assumptions (Tunable; Not Theorems)

| Parameter | Initial Value | Why It May Need Tuning |
|---|:---:|---|
| `P_reserve` spread vs public penalty | 150 bps | Must be recalibrated if target lending protocol penalty changes |
| Bond as % of `R_min` | 2% | Bond adequacy depends on realized net capture in public liquidations |
| Max intra-window price drift | 1.5% | Depends on oracle update frequency and volatility regime |
| Rescue window duration | ~60s (150 slots) | Trade-off: competition vs. price-movement risk |
| Settlement exclusive window | ~12s (30 slots) | Must exceed worst-case JIT flash-loan settlement time |
| Runner-up window | ~8s (20 slots) | Must be nonzero but short to minimize position limbo |
| Target HF post-rescue | 1.20 | Protocol-specific; should match the host lending protocol's safe zone |
| Cooldown after rescue | 7,200 slots (~1hr) | Anti-oscillation; empirically determined |

> **Governance note:** All parameterized values above should be stored in `RescueConfigPDA` and updateable via a governance instruction, never hardcoded in program logic.

---

### 🟠 Known Economic Residuals (Documented; Not Design Failures)

1. **Repeated-game cartel surplus extraction:** A cartel can coordinate to bid at exactly `P_reserve`, capturing the borrower's minimum 1.5% surplus rather than full competitive savings. The invariant prevents harm; it does not force competitive equilibrium. Mitigation: low technical barriers + micro-bond model maximizes bidder set.

2. **Bond heuristic adequacy:** The 2% bond is a starting calibration. Empirical validation against realized public liquidation net-capture rates needed before mainnet.

3. **Single-asset model:** `R_min` formula is derived for one collateral / one debt asset. Multi-collateral positions require a generalized solver. MVP is scoped to single-market pairs only.

4. **JIT execution complexity:** Flash-loan + atomic settlement increases the finalization transaction's computational surface. Must be profiled for Solana compute unit limits.

---

### Architecture Attack Chronology

| Round | Attacker | Verdict |
|:---:|---|---|
| 1 | Grok (initial) | 8 attack vectors identified; incentive gap, timeout race, phantom bids flagged as critical |
| 2 | Antigravity → Grok | Junior note → Atomic reverse-penalty auction. Phantom bids → micro-bond. Griefing → one-way timeout. |
| 3 | Grok counter | Bertrand trap overclaimed. Capital lock residual. Trust boundary precision required. |
| 4 | Antigravity → Grok + ChatGPT | 6 formal invariants specified. `P_reserve` non-worseness. `R_min` closed form. Bond formula. Disjoint eviction slots. |
| 5 | Grok + ChatGPT joint | `P_reserve` conceded as strongest addition. Collusion bounded not eliminated. Bond heuristic not theorem. Multi-asset gap noted. **Green light for implementation.** |

**Grok's exact words:** *"It is ready for careful implementation and formal verification of the on-chain arithmetic and state machine."*

**ChatGPT's exact words:** *"The architecture has survived adversarial review sufficiently to justify writing the damn code."*

---

> **PHASE 1 (Architecture Attack): COMPLETE**
> **PHASE 2 (Implementation): BEGIN at Milestone 1**
>
> The next enemy is Rust.
