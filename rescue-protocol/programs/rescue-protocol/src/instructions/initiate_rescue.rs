use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::errors::RescueError;
use crate::math::{compute_r_min, compute_required_bond};
use crate::state::{PositionPDA, PositionState, RescueConfigPDA, RescueSessionPDA, SessionState};

#[delegate]
#[derive(Accounts)]
pub struct InitiateRescue<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        del,
        seeds = [
            PositionPDA::SEED_PREFIX,
            position.owner.as_ref(),
            position.collateral_mint.as_ref(),
            position.debt_mint.as_ref()
        ],
        bump = position.bump
    )]
    pub position: Account<'info, PositionPDA>,

    #[account(
        init,
        payer = payer,
        space = RescueSessionPDA::SPACE,
        seeds = [
            RescueSessionPDA::SEED_PREFIX,
            position.key().as_ref(),
            &position.rescue_count.to_le_bytes()
        ],
        bump
    )]
    pub session: Account<'info, RescueSessionPDA>,

    #[account(
        seeds = [RescueConfigPDA::SEED_PREFIX],
        bump = config.bump
    )]
    pub config: Account<'info, RescueConfigPDA>,

    /// CHECK: Optional TEE validator identity
    pub validator: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}

pub fn initiate_rescue(ctx: Context<InitiateRescue>, current_price: i64) -> Result<()> {
    let clock = Clock::get()?;

    // Invariant I5 & State Check: Must be in AtRisk state
    require!(
        ctx.accounts.position.state == PositionState::AtRisk,
        RescueError::PositionNotAtRisk
    );

    let config = &ctx.accounts.config;

    // Invariant I1: Non-worseness reserve penalty calculation
    // P_reserve = P_public - reserve_spread_bps
    require!(
        config.public_penalty_bps > config.reserve_spread_bps,
        RescueError::MathOverflow
    );
    let p_reserve_bps = config.public_penalty_bps - config.reserve_spread_bps;

    // Invariant I2: Minimal Right-Sizing closed form R_min
    let r_min = compute_r_min(
        ctx.accounts.position.collateral_amount,
        ctx.accounts.position.debt_amount,
        current_price,
        config.liquidation_threshold_bps,
        config.target_hf_bps,
        p_reserve_bps,
    )?;

    // Invariant I3: Anti-phantom slashing bond requirement
    let required_bond = compute_required_bond(
        r_min,
        config.bond_pct_bps,
        config.min_bond_amount,
    )?;

    // Invariant I7: Disjoint Slot Windows
    let start_slot = clock.slot;
    let auction_end_slot = start_slot
        .checked_add(config.rescue_window_slots)
        .ok_or(RescueError::MathOverflow)?;

    let winner_settlement_deadline = auction_end_slot
        .checked_add(config.settlement_window_slots)
        .ok_or(RescueError::MathOverflow)?;

    let runner_up_settlement_deadline = winner_settlement_deadline
        .checked_add(config.runner_up_window_slots)
        .ok_or(RescueError::MathOverflow)?;

    let hard_cutoff_slot = runner_up_settlement_deadline;

    // Initialize RescueSessionPDA
    let session = &mut ctx.accounts.session;
    session.position = ctx.accounts.position.key();
    session.rescue_index = ctx.accounts.position.rescue_count;
    session.state = SessionState::AuctionOpen;
    session.start_slot = start_slot;
    session.auction_end_slot = auction_end_slot;
    session.winner_settlement_deadline = winner_settlement_deadline;
    session.runner_up_settlement_deadline = runner_up_settlement_deadline;
    session.hard_cutoff_slot = hard_cutoff_slot;
    session.r_min = r_min;
    session.required_bond = required_bond;
    session.p_reserve_bps = p_reserve_bps;
    session.price_at_match = 0;
    session.winning_bidder = Pubkey::default();
    session.winning_penalty_bps = 0;
    session.runner_up_bidder = Pubkey::default();
    session.runner_up_penalty_bps = 0;
    session.bump = ctx.bumps.session;

    let session_key = session.key();

    // Update Position state and session pointer
    let position = &mut ctx.accounts.position;
    position.state = PositionState::InInterventionZone;
    position.active_session = session_key;

    // Extract PDA seeds and bump before CPI delegation
    let owner_key = position.owner;
    let collateral_mint_key = position.collateral_mint;
    let debt_mint_key = position.debt_mint;
    let position_bump = position.bump;
    let validator = ctx.accounts.validator.as_ref().map(|v| v.key());

    // Invariant I10: Delegate PositionPDA to MagicBlock TEE validator
    // Base layer mutation/liquidation is now locked with Error 3007
    ctx.accounts.delegate_position(
        &ctx.accounts.payer,
        &[
            PositionPDA::SEED_PREFIX,
            owner_key.as_ref(),
            collateral_mint_key.as_ref(),
            debt_mint_key.as_ref(),
            &[position_bump],
        ],
        DelegateConfig {
            validator,
            ..Default::default()
        },
    )?;

    msg!(
        "Rescue initiated! Session: {}, R_min: {}, P_reserve: {} bps, Cutoff slot: {}",
        session_key,
        r_min,
        p_reserve_bps,
        hard_cutoff_slot
    );

    Ok(())
}
