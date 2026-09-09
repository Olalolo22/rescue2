use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::math::compute_collateral_seized;
use crate::state::{PositionPDA, PositionState, RescueConfigPDA};

#[derive(Accounts)]
pub struct Liquidate<'info> {
    pub liquidator: Signer<'info>,

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
        seeds = [RescueConfigPDA::SEED_PREFIX],
        bump = config.bump
    )]
    pub config: Account<'info, RescueConfigPDA>,
}

pub fn liquidate(ctx: Context<Liquidate>, repay_debt_amount: u64, current_price: i64) -> Result<()> {
    let position = &mut ctx.accounts.position;
    let config = &ctx.accounts.config;

    // Invariant I10: If in intervention zone (delegated to TEE), liquidation is forbidden
    require!(
        position.state != PositionState::InInterventionZone,
        RescueError::InterventionZoneActive
    );

    // Public liquidation is ONLY permitted if position has timed out or been force-evicted
    // into the terminal Liquidatable state (Invariant I5)
    require!(
        position.state == PositionState::Liquidatable,
        RescueError::InterventionZoneActive
    );

    // Maximum 50% close factor
    let max_close = position.debt_amount / 2;
    let actual_repay = std::cmp::min(repay_debt_amount, max_close);
    require!(actual_repay > 0, RescueError::MathOverflow);

    // Compute seized collateral at the full public penalty
    let collateral_seized = compute_collateral_seized(
        actual_repay,
        config.public_penalty_bps,
        current_price,
    )?;

    require!(
        position.collateral_amount >= collateral_seized,
        RescueError::MathOverflow
    );

    position.debt_amount = position.debt_amount.saturating_sub(actual_repay);
    position.collateral_amount = position.collateral_amount.saturating_sub(collateral_seized);

    msg!(
        "Public liquidation executed by {}. Repaid: {}, Collateral seized: {} at penalty: {} bps",
        ctx.accounts.liquidator.key(),
        actual_repay,
        collateral_seized,
        config.public_penalty_bps
    );

    Ok(())
}
