use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod errors;
pub mod instructions;
pub mod math;
pub mod state;

pub use errors::*;
use instructions::*;
pub use math::*;
pub use state::*;

declare_id!("GCcUbgthDu323rfq9Z3iWNFR632wXWMZ66KKtdTtxDBT");

#[ephemeral]
#[program]
pub mod rescue_protocol {
    use super::*;

    // ─────────────────────────────────────────────────────────────────────────
    //  Milestone 1: Host Lending Program & Governance
    // ─────────────────────────────────────────────────────────────────────────

    /// Initialize global governance parameters (RescueConfigPDA).
    pub fn init_config(
        ctx: Context<InitConfig>,
        reserve_spread_bps: u16,
        bond_pct_bps: u16,
        min_bond_amount: u64,
        max_drift_bps: u16,
        rescue_window_slots: u64,
        settlement_window_slots: u64,
        runner_up_window_slots: u64,
        target_hf_bps: u32,
        cooldown_slots: u64,
        liquidation_threshold_bps: u32,
        public_penalty_bps: u16,
    ) -> Result<()> {
        instructions::init_config::init_config(
            ctx,
            reserve_spread_bps,
            bond_pct_bps,
            min_bond_amount,
            max_drift_bps,
            rescue_window_slots,
            settlement_window_slots,
            runner_up_window_slots,
            target_hf_bps,
            cooldown_slots,
            liquidation_threshold_bps,
            public_penalty_bps,
        )
    }

    /// Admin update for protocol parameters.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        reserve_spread_bps: Option<u16>,
        bond_pct_bps: Option<u16>,
        min_bond_amount: Option<u64>,
        max_drift_bps: Option<u16>,
        rescue_window_slots: Option<u64>,
        settlement_window_slots: Option<u64>,
        runner_up_window_slots: Option<u64>,
        target_hf_bps: Option<u32>,
        cooldown_slots: Option<u64>,
        liquidation_threshold_bps: Option<u32>,
        public_penalty_bps: Option<u16>,
    ) -> Result<()> {
        instructions::update_config::update_config(
            ctx,
            reserve_spread_bps,
            bond_pct_bps,
            min_bond_amount,
            max_drift_bps,
            rescue_window_slots,
            settlement_window_slots,
            runner_up_window_slots,
            target_hf_bps,
            cooldown_slots,
            liquidation_threshold_bps,
            public_penalty_bps,
        )
    }

    /// Open a new lending position.
    pub fn open_position(ctx: Context<OpenPosition>) -> Result<()> {
        instructions::open_position::open_position(ctx)
    }

    /// Deposit collateral into an active position.
    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        instructions::deposit_collateral::deposit_collateral(ctx, amount)
    }

    /// Borrow debt tokens against collateral.
    pub fn borrow(ctx: Context<Borrow>, amount: u64, current_price: i64) -> Result<()> {
        instructions::borrow::borrow(ctx, amount, current_price)
    }

    /// Flag a deteriorating position as AT_RISK.
    pub fn flag_at_risk(ctx: Context<FlagAtRisk>, current_price: i64) -> Result<()> {
        instructions::flag_at_risk::flag_at_risk(ctx, current_price)
    }

    /// Initiate a rescue session and delegate PositionPDA to the MagicBlock TEE.
    pub fn initiate_rescue(ctx: Context<InitiateRescue>, current_price: i64) -> Result<()> {
        instructions::initiate_rescue::initiate_rescue(ctx, current_price)
    }

    /// Standard public liquidation path (only callable when position is Liquidatable).
    pub fn liquidate(ctx: Context<Liquidate>, repay_debt_amount: u64, current_price: i64) -> Result<()> {
        instructions::liquidate::liquidate(ctx, repay_debt_amount, current_price)
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Milestone 2: ER Auction Engine & Sealed Bidding (Executed on TEE ER)
    // ─────────────────────────────────────────────────────────────────────────

    /// Initialize private EphemeralPermission on TEE for confidential bids.
    pub fn init_bid_permission(ctx: Context<InitBidPermission>, members: Vec<Pubkey>) -> Result<()> {
        instructions::init_bid_permission::init_bid_permission(ctx, members)
    }

    /// Submit a sealed reverse-auction bid inside the TEE ER.
    pub fn submit_bid(ctx: Context<SubmitBid>, penalty_bps: u16, bond_committed: u64) -> Result<()> {
        instructions::submit_bid::submit_bid(ctx, penalty_bps, bond_committed)
    }

    /// Close the auction window on TEE ER and record winning penalty and match price.
    pub fn close_window(ctx: Context<CloseWindow>, current_price: i64) -> Result<()> {
        instructions::close_window::close_window(ctx, current_price)
    }

    /// Probe cross-read security check: Asserts unauthorized readers receive Error 6013.
    pub fn probe_cross_read(ctx: Context<ProbeCrossRead>) -> Result<()> {
        instructions::probe_cross_read::probe_cross_read(ctx)
    }

    /// Program CPI undelegate: Commits TEE state back to base Solana layer.
    pub fn undelegate_position(ctx: Context<UndelegatePosition>) -> Result<()> {
        instructions::undelegate_position::undelegate_position(ctx)
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Milestone 3: Atomic L1 Settlement & Eviction Protocol (Executed on Solana L1)
    // ─────────────────────────────────────────────────────────────────────────

    /// Finalize rescue on Solana L1: Atomic debt repayment, collateral transfer, and audit record.
    pub fn finalize_rescue(ctx: Context<FinalizeRescue>, current_price: i64) -> Result<()> {
        instructions::finalize_rescue::finalize_rescue(ctx, current_price)
    }

    /// Force eviction on Solana L1: Fail-open escape hatch callable past the hard cutoff.
    pub fn force_evict(ctx: Context<ForceEvict>) -> Result<()> {
        instructions::force_evict::force_evict(ctx)
    }
}
