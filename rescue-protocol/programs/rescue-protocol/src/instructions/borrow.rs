use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::math::compute_health_factor;
use crate::state::{PositionPDA, PositionState, RescueConfigPDA};

#[derive(Accounts)]
pub struct Borrow<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [
            PositionPDA::SEED_PREFIX,
            owner.key().as_ref(),
            position.collateral_mint.as_ref(),
            position.debt_mint.as_ref()
        ],
        bump = position.bump,
        has_one = owner
    )]
    pub position: Account<'info, PositionPDA>,

    #[account(
        seeds = [RescueConfigPDA::SEED_PREFIX],
        bump = config.bump
    )]
    pub config: Account<'info, RescueConfigPDA>,
}

pub fn borrow(ctx: Context<Borrow>, amount: u64, current_price: i64) -> Result<()> {
    let position = &mut ctx.accounts.position;
    let config = &ctx.accounts.config;

    require!(
        position.state != PositionState::InInterventionZone,
        RescueError::InterventionZoneActive
    );
    require!(
        position.state != PositionState::Liquidatable,
        RescueError::TerminalState
    );

    let new_debt = position
        .debt_amount
        .checked_add(amount)
        .ok_or(RescueError::MathOverflow)?;

    let hf = compute_health_factor(
        position.collateral_amount,
        new_debt,
        current_price,
        config.liquidation_threshold_bps,
    )?;

    // Must remain comfortably healthy (>= target HF) to borrow
    require!(
        hf >= config.target_hf_bps as u64,
        RescueError::PositionNotHealthy
    );

    position.debt_amount = new_debt;
    position.state = PositionState::Healthy;

    msg!(
        "Borrowed {} debt. Total debt: {}, post-borrow HF: {}",
        amount,
        position.debt_amount,
        hf
    );
    Ok(())
}
