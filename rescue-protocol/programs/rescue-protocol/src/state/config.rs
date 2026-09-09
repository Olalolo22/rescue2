use anchor_lang::prelude::*;

/// Global protocol configuration.
///
/// Stores all parameterized values (see ARCHITECTURE.md §20: Parameterized Assumptions).
/// All fields are governance-updateable by the admin, never hardcoded in core logic.
#[account]
#[derive(Debug)]
pub struct RescueConfigPDA {
    /// Authority that can update these parameters.
    pub admin: Pubkey,

    /// Discount under public liquidation penalty required for valid bids (bps).
    /// Enforces I1: P_reserve = P_public - reserve_spread_bps.
    /// Default: 150 bps (1.50%).
    pub reserve_spread_bps: u16,

    /// Anti-phantom bid bond percentage (bps of R_min).
    /// Default: 200 bps (2.00%).
    pub bond_pct_bps: u16,

    /// Minimum slashing bond in debt token units (e.g. 100 USDC = 100_000_000).
    /// Bond = max(min_bond_amount, R_min * bond_pct_bps / 10_000).
    pub min_bond_amount: u64,

    /// Maximum permissible price drop between TEE auction match and L1 finalization (bps).
    /// Enforces I8: p_L1 / p_match >= (10_000 - max_drift_bps) / 10_000.
    /// Default: 150 bps (1.50%).
    pub max_drift_bps: u16,

    /// Duration of the sealed-bid reverse auction inside the TEE (slots).
    /// Default: 150 slots (~60s).
    pub rescue_window_slots: u64,

    /// Exclusive window granted to the winning bidder to settle on L1 (slots).
    /// Default: 30 slots (~12s).
    pub settlement_window_slots: u64,

    /// Exclusive window granted to the runner-up bidder if winner fails (slots).
    /// Default: 20 slots (~8s).
    pub runner_up_window_slots: u64,

    /// Target post-rescue Health Factor in bps (10_000 = 1.00).
    /// Used in the closed-form R_min calculation and post-rescue verification.
    /// Default: 12_000 (1.20).
    pub target_hf_bps: u32,

    /// Cooldown slots required after a successful rescue before position can re-enter (I6).
    /// Default: 7,200 slots (~1 hour).
    pub cooldown_slots: u64,

    /// Liquidation threshold of the collateral asset in bps (e.g. 8_000 = 80.00%).
    pub liquidation_threshold_bps: u32,

    /// Standard public liquidation penalty in bps (e.g. 800 = 8.00%).
    pub public_penalty_bps: u16,

    /// PDA bump.
    pub bump: u8,
}

impl RescueConfigPDA {
    pub const SPACE: usize = 8      // discriminator
        + 32                         // admin
        + 2                          // reserve_spread_bps
        + 2                          // bond_pct_bps
        + 8                          // min_bond_amount
        + 2                          // max_drift_bps
        + 8                          // rescue_window_slots
        + 8                          // settlement_window_slots
        + 8                          // runner_up_window_slots
        + 4                          // target_hf_bps
        + 8                          // cooldown_slots
        + 4                          // liquidation_threshold_bps
        + 2                          // public_penalty_bps
        + 1;                         // bump

    pub const SEED_PREFIX: &'static [u8] = b"rescue_config";
}
