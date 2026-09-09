use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::math::compute_health_factor;
use crate::state::{PositionPDA, PositionState, RescueConfigPDA};

#[derive(Accounts)]
pub struct FlagAtRisk<'info> {
    /// Keeper or any permissionless monitor
    pub keeper: Signer<'info>,

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

pub fn flag_at_risk(ctx: Context<FlagAtRisk>, current_price: i64) -> Result<()> {
    let position = &mut ctx.accounts.position;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    // Invariant I5: One-way terminal state
    require!(
        position.state != PositionState::Liquidatable,
        RescueError::TerminalState
    );

    // Invariant I10: Cannot flag while currently delegated
    require!(
        position.state != PositionState::InInterventionZone,
        RescueError::AlreadyInInterventionZone
    );

    // Invariant I6: Post-rescue cooldown enforcement
    if position.last_rescued_slot > 0 {
        let cooldown_end = position
            .last_rescued_slot
            .checked_add(config.cooldown_slots)
            .ok_or(RescueError::MathOverflow)?;
        require!(clock.slot >= cooldown_end, RescueError::CooldownActive);
    }

    // Compute Health Factor
    let hf = compute_health_factor(
        position.collateral_amount,
        position.debt_amount,
        current_price,
        config.liquidation_threshold_bps,
    )?;

    // Health factor must be at or below liquidation boundary (10_000 = 1.00)
    // or within at-risk margin (e.g. <= 1.05 = 10_500)
    let at_risk_boundary = 10_500;
    require!(hf <= at_risk_boundary, RescueError::PositionNotAtRisk);

    position.state = PositionState::AtRisk;
    position.price_at_flag = current_price;

    msg!(
        "Position flagged AT_RISK at slot {}. Price: {}, HF: {}",
        clock.slot,
        current_price,
        hf
    );
    Ok(())
}
