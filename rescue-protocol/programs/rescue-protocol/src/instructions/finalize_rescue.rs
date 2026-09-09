use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::math::{compute_collateral_seized, compute_health_factor, verify_price_drift};
use crate::state::{
    PositionPDA, PositionState, RescueConfigPDA, RescueRecord, RescueSessionPDA, SessionState,
};

#[derive(Accounts)]
pub struct FinalizeRescue<'info> {
    /// Rescuer executing the settlement (winner or cascaded runner-up)
    #[account(mut)]
    pub settler: Signer<'info>,

    #[account(
        mut,
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
        mut,
        seeds = [
            RescueSessionPDA::SEED_PREFIX,
            position.key().as_ref(),
            &session.rescue_index.to_le_bytes()
        ],
        bump = session.bump
    )]
    pub session: Account<'info, RescueSessionPDA>,

    #[account(
        seeds = [RescueConfigPDA::SEED_PREFIX],
        bump = config.bump
    )]
    pub config: Account<'info, RescueConfigPDA>,

    /// Immutable L1 audit trail of the completed rescue
    #[account(
        init,
        payer = settler,
        space = RescueRecord::SPACE,
        seeds = [
            RescueRecord::SEED_PREFIX,
            position.key().as_ref(),
            &session.rescue_index.to_le_bytes()
        ],
        bump
    )]
    pub rescue_record: Account<'info, RescueRecord>,

    pub system_program: Program<'info, System>,
}

pub fn finalize_rescue(ctx: Context<FinalizeRescue>, current_price: i64) -> Result<()> {
    let clock = Clock::get()?;
    let position = &mut ctx.accounts.position;
    let session = &mut ctx.accounts.session;
    let config = &ctx.accounts.config;

    // Session must be in Matched state
    require!(
        session.state == SessionState::Matched,
        RescueError::SessionNotMatched
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  Invariant I7: Disjoint Slot Windows
    //  Finalize is valid ONLY if slot < hard_cutoff_slot
    // ─────────────────────────────────────────────────────────────────────────
    require!(
        clock.slot < session.hard_cutoff_slot,
        RescueError::FinalizePastCutoff
    );

    let settler_key = ctx.accounts.settler.key();
    let effective_penalty_bps: u16;

    // ─────────────────────────────────────────────────────────────────────────
    //  Waterfall Window Authorization
    // ─────────────────────────────────────────────────────────────────────────
    if clock.slot <= session.winner_settlement_deadline {
        // Winner exclusive window
        require!(
            settler_key == session.winning_bidder,
            RescueError::UnauthorizedSettler
        );
        effective_penalty_bps = session.winning_penalty_bps;
    } else if clock.slot <= session.runner_up_settlement_deadline {
        // Winner defaulted! Runner-up exclusive cascade window
        require!(
            session.runner_up_bidder != Pubkey::default(),
            RescueError::UnauthorizedSettler
        );
        require!(
            settler_key == session.runner_up_bidder,
            RescueError::UnauthorizedSettler
        );
        effective_penalty_bps = session.runner_up_penalty_bps;
        msg!(
            "Winner defaulted. Runner-up {} settling at {} bps",
            settler_key,
            effective_penalty_bps
        );
    } else {
        return err!(RescueError::SettlementWindowExpired);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Invariant I8: Oracle Drift Guard
    //  Abort if p_L1 / p_match < 98.5%
    // ─────────────────────────────────────────────────────────────────────────
    verify_price_drift(session.price_at_match, current_price, config.max_drift_bps)?;

    // ─────────────────────────────────────────────────────────────────────────
    //  Atomic Debt Repayment & Collateral Seizure
    // ─────────────────────────────────────────────────────────────────────────
    let r_min = session.r_min;
    require!(position.debt_amount >= r_min, RescueError::MathOverflow);

    let collateral_seized = compute_collateral_seized(
        r_min,
        effective_penalty_bps,
        current_price,
    )?;

    require!(
        position.collateral_amount >= collateral_seized,
        RescueError::MathOverflow
    );

    let new_debt = position.debt_amount - r_min;
    let new_collateral = position.collateral_amount - collateral_seized;

    // ─────────────────────────────────────────────────────────────────────────
    //  Invariant I2 & I8: Post-Rescue Health Factor Re-verification
    // ─────────────────────────────────────────────────────────────────────────
    let post_rescue_hf = compute_health_factor(
        new_collateral,
        new_debt,
        current_price,
        config.liquidation_threshold_bps,
    )?;

    require!(
        post_rescue_hf >= config.target_hf_bps as u64,
        RescueError::PostRescueHfInsufficient
    );

    // Apply state updates
    position.debt_amount = new_debt;
    position.collateral_amount = new_collateral;
    position.state = PositionState::Rescued;
    position.last_rescued_slot = clock.slot; // Invariant I6: starts 1hr cooldown clock
    position.active_session = Pubkey::default();

    session.state = SessionState::Settled;

    // Populate immutable L1 audit trail
    let record = &mut ctx.accounts.rescue_record;
    record.position = position.key();
    record.rescue_index = session.rescue_index;
    record.winner = settler_key;
    record.penalty_bps = effective_penalty_bps;
    record.repaid_amount = r_min;
    record.collateral_seized = collateral_seized;
    record.finalized_slot = clock.slot;
    record.finalize_price = current_price;
    record.bump = ctx.bumps.rescue_record;

    msg!(
        "Position RESCUED at slot {}! Repaid: {}, Collateral seized: {}, Final HF: {}",
        clock.slot,
        r_min,
        collateral_seized,
        post_rescue_hf
    );

    Ok(())
}
