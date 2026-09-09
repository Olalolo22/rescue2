use anchor_lang::prelude::*;

/// State machine for a single borrowing position.
///
/// Invariants that MUST NOT be violated (see ARCHITECTURE.md §20):
///   I5: Once Liquidatable, state never reverts.
///   I6: Rescued → cannot re-enter InInterventionZone for COOLDOWN_SLOTS.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PositionState {
    /// Health factor above the AT_RISK threshold.
    Healthy,
    /// Health factor has crossed the AT_RISK threshold. Rescue keeper may now
    /// call `initiate_rescue`. Public liquidation is NOT yet permitted.
    AtRisk,
    /// PositionPDA is delegated to the MagicBlock TEE.
    /// Public liquidation blocked via Error 3007 (AccountOwnedByWrongProgram).
    /// [VERIFIED: Probe 03 & 06]
    InInterventionZone,
    /// Rescue succeeded. Position is back on L1 and healthy (HF ≥ HF_TARGET).
    Rescued,
    /// Rescue window timed out without settlement, or position health
    /// deteriorated past the close-factor abort threshold.
    /// Public liquidation is now permitted. Terminal — cannot leave this state.
    Liquidatable,
}

impl PositionState {
    /// Returns true if this state is terminal (no further transitions possible).
    pub fn is_terminal(self) -> bool {
        self == PositionState::Liquidatable
    }
}

/// A single borrowing position.
///
/// Supports one collateral asset and one debt asset (single-market model).
/// Delegated to the MagicBlock TEE during the InInterventionZone phase.
#[account]
#[derive(Debug)]
pub struct PositionPDA {
    /// The wallet that owns this position.
    pub owner: Pubkey,
    /// SPL mint of the collateral asset.
    pub collateral_mint: Pubkey,
    /// SPL mint of the debt asset.
    pub debt_mint: Pubkey,

    /// Collateral deposited, in collateral asset native units.
    pub collateral_amount: u64,
    /// Outstanding debt, in debt asset native units.
    pub debt_amount: u64,

    /// Pyth price of collateral at the time the AT_RISK flag was raised.
    /// Stored with 6 decimals (PRICE_PRECISION = 1_000_000).
    /// Used as p_match for the oracle drift guard (I8).
    pub price_at_flag: i64,

    /// Current lifecycle state.
    pub state: PositionState,

    /// Slot when the most recent rescue was completed successfully.
    /// 0 if no rescue has been completed.
    /// Used to enforce the post-rescue cooldown (I6).
    pub last_rescued_slot: u64,

    /// Pubkey of the active RescueSessionPDA, or Pubkey::default() if none.
    pub active_session: Pubkey,

    /// Monotonically increasing rescue attempt counter (for audit trail).
    pub rescue_count: u16,
    /// PDA bump.
    pub bump: u8,
}

impl PositionPDA {
    pub const SPACE: usize = 8      // discriminator
        + 32                         // owner
        + 32                         // collateral_mint
        + 32                         // debt_mint
        + 8                          // collateral_amount
        + 8                          // debt_amount
        + 8                          // price_at_flag
        + 1                          // state (enum tag)
        + 8                          // last_rescued_slot
        + 32                         // active_session
        + 2                          // rescue_count
        + 1;                         // bump

    pub const SEED_PREFIX: &'static [u8] = b"position";
}

/// Immutable audit trail written to L1 on every completed rescue.
#[account]
#[derive(Debug)]
pub struct RescueRecord {
    /// The PositionPDA this record relates to.
    pub position: Pubkey,
    /// Which rescue attempt this was (matches position.rescue_count).
    pub rescue_index: u16,
    /// The winning lender's session key / address.
    pub winner: Pubkey,
    /// Penalty applied (bps, e.g. 250 = 2.50%).
    pub penalty_bps: u16,
    /// Amount of debt repaid (in debt asset units).
    pub repaid_amount: u64,
    /// Collateral seized and paid to the rescuer.
    pub collateral_seized: u64,
    /// L1 slot when finalize_rescue was confirmed.
    pub finalized_slot: u64,
    /// Collateral price at finalization (6 decimals).
    pub finalize_price: i64,
    /// PDA bump.
    pub bump: u8,
}

impl RescueRecord {
    pub const SPACE: usize = 8      // discriminator
        + 32                         // position
        + 2                          // rescue_index
        + 32                         // winner
        + 2                          // penalty_bps
        + 8                          // repaid_amount
        + 8                          // collateral_seized
        + 8                          // finalized_slot
        + 8                          // finalize_price
        + 1;                         // bump

    pub const SEED_PREFIX: &'static [u8] = b"rescue_record";
}
