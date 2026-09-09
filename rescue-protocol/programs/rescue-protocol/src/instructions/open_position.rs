use anchor_lang::prelude::*;
use crate::state::{PositionPDA, PositionState};

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Collateral SPL mint
    pub collateral_mint: UncheckedAccount<'info>,

    /// CHECK: Debt SPL mint
    pub debt_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = PositionPDA::SPACE,
        seeds = [
            PositionPDA::SEED_PREFIX,
            owner.key().as_ref(),
            collateral_mint.key().as_ref(),
            debt_mint.key().as_ref()
        ],
        bump
    )]
    pub position: Account<'info, PositionPDA>,

    pub system_program: Program<'info, System>,
}

pub fn open_position(ctx: Context<OpenPosition>) -> Result<()> {
    let position = &mut ctx.accounts.position;
    position.owner = ctx.accounts.owner.key();
    position.collateral_mint = ctx.accounts.collateral_mint.key();
    position.debt_mint = ctx.accounts.debt_mint.key();
    position.collateral_amount = 0;
    position.debt_amount = 0;
    position.price_at_flag = 0;
    position.state = PositionState::Healthy;
    position.last_rescued_slot = 0;
    position.active_session = Pubkey::default();
    position.rescue_count = 0;
    position.bump = ctx.bumps.position;

    msg!("Opened position for owner={}", position.owner);
    Ok(())
}
