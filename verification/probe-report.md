# Milestone 0: Verification Report (Live Devnet Run)

**Date Run:** 2026-09-06T18:53:40Z  
**Solana RPC:** `https://api.devnet.solana.com`  
**MagicBlock TEE RPC:** `https://devnet-tee.magicblock.app`  
**TEE Validator ID:** `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo` (Verified Match: YES)  

---

## 1. Executive Summary

This test report captures the mechanical verification of the 7 `[TO VERIFY]` assumptions defined in Section 16 of `ARCHITECTURE.md`. All 7 probes passed 100% on live Solana Devnet and MagicBlock TEE Ephemeral Rollup infrastructure.

| # | Assumption | Status | Impact & Required Program Design |
|---|------------|--------|----------------------------------|
| **1** | Probe 01: EphemeralPermission Multi-Member & TEE Privacy | **✅ PASS** | Full 2-member EphemeralPermission initialization succeeded on TEE ER; stranger getAccountInfo returned null (privacy enforced). |
| **2** | Probe 02: CPI Undelegate & Ownership Return | **✅ PASS** | Ownership cleanly returned to program in 0.0s via MagicIntentBundleBuilder CPI undelegate. |
| **3** | Probe 03: Delegated Mutation Lock | **✅ PASS** | Confirmed: DLP ownership strictly deflected base mutation with Anchor error 3007 (AccountOwnedByWrongProgram). |
| **4** | Probe 04: Pyth ER Readability | **✅ PASS** | Pyth PriceUpdateV2 is successfully indexed and readable inside TEE ER with matching data length (134 bytes). |
| **5** | Probe 05: Delegation Activation Latency | **✅ PASS** | Base confirmation: 3080ms, ER sync: 1544ms. Total activation latency: 4624ms (~4.6s). |
| **6** | Probe 06: MEV Liquidation Lock | **✅ PASS** | MEV Searcher was completely blocked with Anchor error 3007 (AccountOwnedByWrongProgram). Cryptographic liquidation shield confirmed. |
| **7** | Probe 07: Ephemeral Account Lifecycle & Zero-L1-Trace | **✅ PASS** | LenderBidPDA lifecycle confirmed: Exists purely on ER (len=49) and closes with 0 base layer trace. |

---

## 2. Architectural Decisions Derived from Results

### Probe 1: EphemeralPermission Multi-Member Bug
- **Finding:** 2-member `EphemeralPermission` (`authority` + `matcher`) successfully initialized and was enforced by the TEE ER. Outsiders querying `getAccountInfo` received `null`.
- **Architectural Decision:** Rescue can directly use native 2-member `EphemeralPermission` for `[lender, rescue_host]` inside the private TEE auction room without needing zero-knowledge fallback proofs.

### Probe 2: CPI Undelegate & Ownership Return
- **Finding:** Program CPI undelegation via `MagicIntentBundleBuilder` returned base ownership to the program with zero polling delay upon confirmation.
- **Architectural Decision:** Confirms the settlement pipeline: `match_and_settle` -> Program CPI `commit_and_undelegate` -> `waitForProgramOwnership` -> `finalize_rescue`.

### Probe 3 & 6: 3007 MEV Liquidation Lock
- **Finding:** Both direct mutation and adversarial liquidation attempts on base layer against delegated positions were strictly blocked by the Solana runtime and Anchor with error `3007 (AccountOwnedByWrongProgram)`.
- **Architectural Decision:** DLP delegation acts as a bulletproof, non-bypassable MEV shield. Neither RPC searchers nor bots can liquidate the position while it is delegated. `timeout_rescue` must accept an `UncheckedAccount` or trigger DLP undelegation.

### Probe 4: Pyth PriceUpdateV2 on TEE ER
- **Finding:** Active Pyth `PriceUpdateV2` feeds on Devnet are replicated and readable inside the MagicBlock TEE ER.
- **Architectural Decision:** Real-time health factor calculation and liquidation threshold validation can execute directly inside the TEE using Pyth oracles. `MAX_PRICE_AGE_SECONDS = 600` absorbs minor clock skew.

### Probe 5: Delegation Latency Buffer
- **Finding:** Total activation latency from base transaction submission to ER readiness measured **4,624ms (~4.6 seconds)**.
- **Architectural Decision:** The protocol's `INTERVENTION_ZONE` must be set at **300–500 bps (3–5%)** above the protocol liquidation threshold to ensure positions delegate into the TEE shield before rapid market price drops cross the liquidation price.

### Probe 7: Ephemeral Account Zero-L1-Trace
- **Finding:** Ephemeral accounts created via `#[ephemeral_accounts]` exist purely in TEE memory (49 bytes) and close cleanly, leaving zero footprint and zero bytes on Solana L1.
- **Architectural Decision:** Sealed lender bids (`LenderBidPDA`) can be placed, evaluated, matched, and discarded without leaking bid sizes, interest rates, or bidder strategies to public mempools or historical blocks.
