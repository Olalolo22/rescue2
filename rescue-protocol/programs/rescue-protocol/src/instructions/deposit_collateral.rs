use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::state::{PositionPDA, PositionState};

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
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
}

pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
    let position = &mut ctx.accounts.position;

    // Cannot deposit while position is actively delegated in TEE intervention
    require!(
        position.state != PositionState::InInterventionZone,
        RescueError::InterventionZoneActive
    );

    position.collateral_amount = position
        .collateral_amount
        .checked_add(amount)
        .ok_or(RescueError::MathOverflow)?;

    msg!(
        "Deposited {} collateral. Total collateral: {}",
        amount,
        position.collateral_amount
    );
    Ok(())
}
