# Rescue — Brainstorm Dossier
> Full argument trace from ideation to settled decision. Written so any agent or human can 
> pick this up cold and continue the architecture/framing conversation without losing context.

---

## 0. The Blitz 8 Constraint

**Hackathon:** MagicBlock Blitz 8 (Solana)  
**Judging criteria (V7/V8 language):** Creativity, technical depth, how convincingly the project showcases what's possible on Solana, with meaningful Ephemeral Rollup usage required.  
**Builder's prior work:** RugRoll (a crash-game / round-based wagering protocol on Solana).  
**Builder's explicit constraint:** *"I don't want to build another Supersize"* — i.e. no real-time multiplayer game that uses the ER only for execution speed while the blockchain is merely cosmetic.

---

## 1. MagicBlock Stack (Verified from Docs)

| Primitive | What it actually does |
|---|---|
| **Ephemeral Rollup (ER)** | Temporarily takes ownership of delegated Solana accounts. Runs a sub-millisecond SVM tick. Accounts committed back to L1 on undelegation. |
| **Ephemeral Accounts** | Accounts that are born, live, and die *entirely* inside the ER — never touch Solana L1 state. Closed with `close_ephemeral_*`; rent refunded. |
| **Private Ephemeral Rollup (PER)** | TEE-backed (Intel TDX) execution environment. State is protected from all unauthorized parties, including the machine operator. Access rules enforced on-chain at account level. Not "encrypted transactions" — it is hardware-secured private mutable state. |
| **Magic Actions** | After an ER commit, attached instructions automatically execute on Solana's base layer. **Direction: ER → L1, not L1 → ER.** |
| **Cranks** | Automated time-based on-chain instruction execution inside the ER. |
| **VRF** | Verifiable randomness available inside the ER. |
| **L1 trigger** | **NOT a native primitive.** A keeper/watcher service subscribes to Solana account changes via WebSocket, detects conditions, and sends transactions to the ER to initiate delegation. This is standard Solana RPC, not MagicBlock magic. Don't pitch it as if MagicBlock auto-watches L1. |

**CRITICAL VERIFIED DETAIL FROM MAGICBLOCK CORE TEAM (via Telegram support):**  
> *User question:* "When a session ends and ephemeral accounts are closed, is any intermediate state retained anywhere? say on magicblocks servers or an er local ledger? Or is it total unrecoverable?"  
> *MagicBlock Core Team reply:* **"Ephemeral accounts are state only exist on ER and will always persist. ending session wont close states on ER, only syncing state from ER to Solana."**

**What this means for the architecture:**
1. **"Ephemeral" means "Off-Solana-L1", NOT "Forensically Erased":** Ephemeral accounts exist strictly on the ER runtime—they avoid Solana L1 rent, L1 state bloat, and gas fees. But on the ER validator, state persists on the local ER ledger.
2. **Ending an ER session is a sync barrier, not a wipe:** Undelegating or ending a session commits modified accounts to Solana L1; it does NOT zero-fill or purge the ER node's database.
3. **Pitching rule for MagicBlock judges:** NEVER claim "all data vanishes from physical servers without a trace upon session end." The core team knows their node software keeps ledger state. Frame ephemerality as **off-chain computational isolation, zero-L1-rent lifecycle, and sub-millisecond execution**, with PER providing **hardware-secured TEE confidentiality during active execution**.

---

## 2. The Hunting Framework We Used

**The brutal rule:** Don't start with an app. Start with a phenomenon that Solana L1 cannot comfortably express. Then ask what product naturally falls out of it.

**The lens:** *"What should be ephemeral?"*

**The MagicBlock disappears test:** If you remove the ER from the architecture, does the *thing you're building* cease to be the same thing ontologically? Not "does it become slower?" — does it stop existing as the same product?

**The four-property hunt (GPT's final formulation):**  
A financial process whose intermediate state is simultaneously:
1. **Too valuable to reveal** — private
2. **Too dynamic for L1** — changes faster than Solana blocks can express
3. **Too interactive to reduce to a proof** — live computation, not verifying past computation
4. **Too temporary to justify permanent infrastructure** — the state has no sensible permanent form

---

## 3. Ideas Considered and Why They Were Rejected or Deprioritized

### ❌ Ephemeral Governance
*"Governance as a session rather than a permanent database."*  
Discord + server + final on-chain vote already does this. Nothing technically forces governance to need the ER. Killed for contrivance.

### ❌ Real-time multiplayer game (Supersize variant)
Standard game. ER just replaces a trusted game server. Remove ER → build on AWS. Same product. Weak MagicBlock necessity test.

### ⚠️ Private Prediction Market around on-chain events
*Auto-spawning prediction market where all positions are private during the window.*  
Passes MagicBlock necessity (private positions = PER, auto-spawn = keeper + ER, continuous consensus price = continuous execution). But the "informed trader won't reveal edge" argument is strong and Polymarket can't replicate it. However: GPT correctly noted this can feel contrived — *"whale moves → prediction market"* manufactures a use case to exercise PER. Verdict: interesting but weaker than Rescue.

### ❌ GHOST — Dark Order Protocol (Formally Invalidated by Core Team TG Clarification)
*Trustless dark pool where every market is temporary.*  
Large order intent submitted → Ghost Market auto-spawns → counterparties compete privately to fill → trade commits to L1 → market dies.  
**Initial pitch appeal:** Real problem ($40B/day TradFi dark pool market with zero trustless DeFi equivalent). Premise claimed: *"The machine's death itself is the privacy guarantee; fills leave no trace."*  
**Why it failed / why Rescue beats it:**  
1. **Factually broken on MagicBlock architecture:** The MagicBlock team confirmed *ephemeral state persists on the ER ledger after sessions end*. GHOST's core claim that "the market's death erases all forensic traces" is technically false. Pitching this would fail instantly under judge scrutiny.
2. **Permanent alternative exists:** A whale *can* use an existing permanent order book or OTC desk; they are choosing not to. Rescue, by contrast, creates a market where currently *no market or negotiation state exists at all in DeFi*.

### ✅ Reactive Economic Machines (design thesis, not product)
*On-chain events create temporary economic environments that execute, resolve and disappear.*  
**BORN → OPEN → COMPETITION → CLOSING → RESOLUTION → SETTLEMENT → DEAD**  
This is the correct abstraction *underneath* all the candidates. Not a product itself — it's the design space. The discriminating test for any specific machine: *"Machine B cannot meaningfully exist until Machine A produces the economic condition that creates it."*

---

## 4. How We Got to Rescue

**The key reframe (GPT):** Stop asking "what financial auction can we make faster?" Ask: *"What economic process currently requires an always-on system, but whose actual lifespan is only a few seconds?"*

**The DeFi observation:** Lending protocols (Aave, Marginfi, Kamino, Solend) have a **binary transition** where a continuously changing financial state (health factor) suddenly crosses a threshold and becomes a permissionless liquidation opportunity. There is **no intermediate negotiation state** in DeFi. On Marginfi: once health factor < 1.0, anyone can call `liquidate`. The borrower can add collateral or repay manually, but there is no competitive, permissionless, private market for rescuing an at-risk position with bespoke capital and terms.

**The correct novelty claim:** *"DeFi has no competitive, permissionless, private market for rescuing an at-risk position with bespoke capital and terms before liquidation."*

**The killer framing (GPT):** *"Liquidation is a race. Rescue turns it into a market."*

**Why all four properties are satisfied:**

| Property | Why Rescue satisfies it |
|---|---|
| Too valuable to reveal | Lender A knowing you're also negotiating with Lender B destroys your position. Borrower knowing Lender A's true minimum wrecks theirs. Revealing your bid strategy means competitors undercut by epsilon. |
| Too dynamic for L1 | Collateral ratios change every block with price movements. A lender's conditional offer ("I'll rescue if ETH ≥ $2,900 AND health factor < 1.05 AND rate = 9%") is a function of live oracle state — you can't express a continuously-evaluating conditional offer on L1 without paying for every price update as a transaction. |
| Too interactive for a proof | You're running live multi-party negotiation where each counter-offer depends on current market state AND current conversation state AND competing offers simultaneously. ZK proves past computation; this is future computation that depends on real-time inputs. |
| Too temporary to justify permanent infrastructure | The rescue window exists ONLY during the interval between health_factor ≈ liquidation_threshold and resolution. Once resolved (rescued or liquidated), the machine has no reason to exist — not by design, but by definition. The window might be 30 seconds. A permanent "near-liquidation deal orderbook" is ontologically incoherent. |

**Why Rescue beats GHOST on GPT's criterion:**  
With GHOST, the permanent alternative EXISTS (use a normal order book, hire an OTC desk). The whale is *choosing* not to for privacy.  
With Rescue, the permanent alternative is the **complete absence of the process**. There is NO negotiation in DeFi today. The machine doesn't replace a permanent structure — it creates something that has never existed.

---

## 5. The MEV Context (Why Lenders Participate)

**Current liquidation mechanics on Solana:** Position becomes liquidatable → bots race to call `liquidate` → fastest/Jito-connected actor captures the liquidation bonus (typically 5–15% discount on collateral). Jito explicitly describes near-liquidation accounts as MEV opportunities. Bot competition is intense.

**The lender incentive for Rescue:**  
The rescue window **democratizes access to profitable DeFi lending opportunities currently dominated by MEV bots.**

- Top 3-5 liquidation bots capture the vast majority of liquidations via Jito bundles
- A smaller capital allocator ($500k+) who'd love to earn 8-15% on short-term DeFi lending literally cannot compete in the liquidation race — they get front-run every time
- The Rescue Machine changes the game: speed matters less than **offer quality**, private bids mean they **can't be front-run**, the window is exclusive

**Result:** Rescue creates a market for a class of participant (quality capital, not speed capital) that currently has no access to this opportunity. Not "better than liquidation for existing bots" — a new market for different participants.

**Why PER is load-bearing for auction mechanics (Time-Bounded Pre-Settlement Confidentiality):**  
- **Time-bounded confidentiality vs. forensic erasure:** Rescue does *not* require historical records to vanish from the universe forever. It requires **pre-settlement privacy during the 15–30 second negotiation window**. Once the winning restructure commits to Solana L1, the race is over; front-running is impossible post-settlement. Persistent ER ledger state does not harm Rescue at all (it actually aids auditability).
- **Anti-MEV / sealed-bid dynamics:** If lenders can see each other's offers in real time, they converge to slightly-better-than-worst, undercutting by $\epsilon$ and offering the borrower poor terms.  
- **Genuine price discovery:** In the PER (TEE hardware-enforced private state), lenders submit conditional bids based on their independent risk models without seeing competitor bids. The borrower gets genuine competitive terms, and capital allocators cannot be front-run by MEV searchers.

---

## 6. The Architectural Core

### The State Machine
```
HEALTHY (health_factor > threshold_upper)
    ↓ (price deteriorates)
AT_RISK (threshold_lower < health_factor < threshold_upper)
    ↓ (keeper detects, initiates delegation)
RESCUE_WINDOW_ACTIVE  ←── ER owns the position account
    ↓ (deal found)          ↓ (timeout / price collapse)
RESCUED                    LIQUIDATABLE
(ER commits new terms,     (ER undelegates with flag,
undelegates → L1)          bots can now liquidate)
```

### The Delegation Lock: Solana Runtime Reality Check
GPT rightly flagged a crucial technical nuance: *"Delegation IS the lock"* is an architectural claim that depends entirely on **which account is delegated and who owns it**:

1. **The Solana Runtime Rule:**  
   Only the program that owns an account can CPI into the MagicBlock Delegation program to delegate it. Marginfi owns `MarginfiAccount` (`MFv2...`), NOT Rescue. A third-party program cannot delegate Marginfi's account.
2. **Why a naive wrapper cannot block L1 liquidation if $HF < 1.00$:**  
   When a liquidation bot calls `marginfi::lending_account_liquidate` on L1, it passes `MarginfiAccount`, `Bank`, and token accounts. It does *not* pass or touch any external Rescue PDA. If the position is already liquidatable ($HF < 1.00$), L1 validators will happily execute Marginfi's liquidation transaction because none of Marginfi's accounts are delegated to MagicBlock!
3. **How the lock actually works in practice:**
   * **In the Pre-Liquidation Buffer ($1.00 < HF < 1.05$):** The lock is enforced by **Marginfi's own risk engine rules**. Marginfi reverts any call to `liquidate` with `AccountNotLiquidatable`. MEV bots are legally prohibited from touching the account on L1. The Rescue Smart Account delegates *itself* to the ER to negotiate repayment before $HF$ ever touches 1.00.
   * **In Native Protocol Integration (Rescue as a Primitive):** Marginfi's own contract natively integrates Rescue. When $HF$ hits the warning threshold, Marginfi itself delegates `MarginfiAccount` to the ER. **HERE, Delegation literally IS the lock** on L1 because Marginfi's account itself is frozen on L1.

### What the MagicBlock primitives actually do:
- **ER:** Continuously runs rescue matching logic against changing live oracle state (sub-millisecond ticks).
- **PER (Private ER):** Shields individual lender bids and conditional strategies inside Intel TDX TEEs—providing **time-bounded pre-settlement confidentiality** so competing lenders and L1 searchers cannot front-run or undercut during the auction.
- **Solana L1:** Authoritative ledger; state transitions settle atomically back to L1 via Magic Actions.
- **Magic Actions:** Trigger downstream L1 settlement instructions (e.g. `marginfi::repay`, collateral reassignments) after ER results commit.
- **Keeper/watcher:** Subscribes to Solana account/oracle streams via WebSocket; initiates delegation when health factor enters the pre-liquidation buffer.

---

## 7. The Aegis Ledger Lesson & The 3 Architectural Tiers

The builder previously built **Aegis Ledger** — a confidential treasury coordination layer for DAO payroll.  
**The architectural mistake:** built custom settlement infrastructure instead of composing on top of Squads (established multisig with existing users and trust). Result: users had to trust unaudited code with real treasury funds.

Applying this lesson to Rescue yields **four possible architectures**:

### Tier 1: ❌ Rescue Lending Protocol (The Aegis Mistake)
- **Design:** We build our own lending, collateral, interest rates, risk engine, and liquidation logic.
- **Verdict:** **FATAL.** Nobody trusts unaudited smart contracts with collateral. Judges will dismiss it as a toy hackathon pool that has no path to real liquidity or adoption.

### Tier 2: 🟡 The "Pre-Liquidation Buffer" Smart Account ($1.00 < HF < 1.05$)
- **Design:** User interacts with Marginfi/Kamino via a **Rescue Smart Account** (a 1:1 non-custodial proxy PDA, identical in trust model to a Kamino Multiply vault or Squads sub-account).
  * 99.9% of the time: 100% pass-through non-custodial control (deposit, borrow, withdraw).
  * When $1.01 < HF < 1.05$: Smart Account triggers `RESCUE_ACTIVE`, delegates *itself* to the Private ER.
  * Lenders bid privately on restructuring/repayment terms.
  * Winning offer executes `marginfi::repay` via Magic Action **before $HF$ ever hits 1.00.**
- **Solana Runtime reality:** It doesn't *need* to intercept Marginfi's L1 liquidation instruction because Marginfi itself rejects any `liquidate` call when $HF > 1.00$. It cures the disease in the safety window before MEV bots are legally permitted to strike.

### Tier 3: 🟢 Rescue as a Native Protocol Primitive (The Core Vision)
- **Design:** Rescue is an open-source pre-liquidation module built *for* lending protocols (Marginfi, Kamino, Drift, Save).
- **The State Machine:**
  ```
  HEALTHY → AT_RISK → RESCUE_WINDOW (Delegated to ER) → RESCUED (Repaid)
                                                      ↓ (Timeout / No Bids)
                                                  LIQUIDATABLE (Standard L1 MEV Race)
  ```
- **Solana Runtime reality:** Because Marginfi/Kamino's *own program* invokes the MagicBlock delegation CPI, **Delegation literally IS the lock on L1**. External liquidation bots attempting to call `liquidate` fail at the SVM level because the account is delegated.
- **The pitch story:** *"Just as Pyth became the oracle standard and Jito became the MEV standard, Rescue is the ephemeral restructuring standard for Solana credit."*

### Tier 4: 🔵 Receivership Liquidator (Marginfi Project 0 Native Intercept)
- **Design:** Marginfi Project 0 introduced *receivership liquidation* (`start_liquidation` → receivership → `end_liquidation`), where a receiver takes temporary control to restructure unhealthy accounts.
- **How Rescue plugs in:** Instead of a single MEV bot seizing receivership to dump collateral on an AMM, **Rescue's contract calls `start_liquidation` as the Receiver**, delegates the receivership right to MagicBlock PER for a 20-second sealed auction among capital allocators, commits the best restructuring terms back to L1, and calls `end_liquidation`.

---

## 8. Hackathon Strategy: Winning Blitz 8 Without the Aegis Trap

**The Trap:** Building a toy lending protocol and asking judges to evaluate it as a new DeFi lender.  
**The Solution:** Build and present **Rescue as the Reference Implementation of the Ephemeral Pre-Liquidation Primitive.**

1. **The Product Pitch:**  
   *"We are not a lending protocol. Marginfi and Kamino solved lending. We built the missing pre-liquidation state that activates in the terrifying 30 seconds before a position is wiped out."*
2. **The Hackathon Deliverable:**  
   * **Core Engine:** A clean, rigorous position state machine that integrates Pyth oracles + MagicBlock ER/PER to run the real-time private restructuring auction.
   * **Adapter Spec (RFC):** A complete, documented adapter interface showing how Marginfi v2 / Kamino integrate Rescue natively (Tier 3) or via Smart Account proxies (Tier 2).
3. **The Live Demo:**  
   * Inject price drop via Pyth oracles.
   * Position enters `AT_RISK` ($HF = 1.04$).
   * Rescue Machine materializes on MagicBlock ER.
   * Multiple simulated lender agents submit private sealed restructuring bids in the TEE (PER).
   * Sub-millisecond ER matching selects the winning restructure.
   * Magic Action settles the repayment atomically.
   * Machine disappears; position is restored to `HEALTHY`; zero liquidation penalty incurred.

---

## 9. Open Dilemmas (Updated Status)

### A. The exact trigger design
A keeper service or crank monitors health factor via Pyth oracle price feeds against position accounts. When $HF$ crosses the alert threshold (e.g. 1.05), it calls `initiate_rescue`, triggering ER delegation.

### B. What exactly do lenders bid?
Conditional executable strategies evaluated inside PER:
```
I'll provide $80k rescue IF:
  - Collateral asset price ≥ $P_min
  - Effective LTV post-rescue ≤ 80%
  - Borrower agrees to interest rate = 9.5% APR
  - Offer TTL = 15 seconds
```
The ER continuously matches these bids against live oracle state.

### C. Preventing liquidation bypass during the window (RESOLVED)
- **Tier 2 (Proxy):** Bounded within $1.00 < HF < 1.05$ where Marginfi reverts liquidation attempts on L1.
- **Tier 3 (Primitive):** Program-native delegation physically locks the `MarginfiAccount` from L1 transactions.

### D. The borrower UX during the window
Pre-authorized restructuring policy (borrower sets maximum acceptable APR and terms in advance), with optional real-time manual acceptance if active on the UI. If pre-authorized criteria match, the ER auto-executes immediately.

### E. Lender capital source
Lenders deposit liquidity into an on-chain Rescue Liquidity Pool (or provide pre-signed Flash-Loan commitments). Once a bid wins, funds are drawn and injected into Marginfi atomically via Magic Action.

### F. The "position commitment" vs "public order" problem
Distress is not broadcast as a public orderbook intent. The keeper triggers the ER session directly from publicly verifiable oracle/account state. All bidder negotiation happens in the PER (TEE).

### G. Hackathon scope (RESOLVED)
Build the Reference Implementation of the Ephemeral Restructuring Primitive. Do NOT pretend to be an audited consumer lending bank.

---

## 10. The Settled Decision

**Project name:** Rescue (working title)

**One-line thesis:**  
*A temporary private market that appears when a DeFi lending position approaches liquidation, letting capital allocators compete on live restructuring terms before the liquidation boundary is crossed.*

**The framing that works:**  
*"Liquidation is a race. Rescue turns it into a market."*

**What wins Blitz 8:**  
- Fully ephemeral machine whose existence is justified by a specific on-chain financial state
- PER is load-bearing (not decorative) — it's what makes the auction mechanism produce genuine price discovery instead of a race-to-minimum
- ER is load-bearing — continuously evaluating live conditional lender strategies against live oracle state
- Magic Actions settle the result back to L1
- Demo: watch health factor fall → Rescue Machine spawns → lenders compete privately → best offer wins → machine dies → liquidation never fires

**MagicBlock necessity test (passed):**  
Remove MagicBlock → replace with: centralized server (custody risk, censorship risk) + trusted auctioneer + private database + manual L1 settlement. You've built an OTC desk, not a trustless market. The thing changes ontologically.
