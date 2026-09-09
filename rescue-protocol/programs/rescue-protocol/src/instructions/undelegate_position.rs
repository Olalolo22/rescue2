use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

#[commit]
#[derive(Accounts)]
pub struct UndelegatePosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Delegated PositionPDA currently owned by MagicBlock DLP
    #[account(mut)]
    pub position: UncheckedAccount<'info>,

    /// CHECK: MagicBlock context account required for ER commit & undelegate CPI
    #[account(mut)]
    pub magic_context: UncheckedAccount<'info>,

    /// CHECK: MagicBlock magic program
    pub magic_program: UncheckedAccount<'info>,
}

pub fn undelegate_position(ctx: Context<UndelegatePosition>) -> Result<()> {
    msg!("Committing position state and undelegating back to base layer...");

    MagicIntentBundleBuilder::new(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.position.to_account_info()])
    .build_and_invoke()?;

    msg!("Undelegate CPI invoked successfully. Account ownership returning to base program.");
    Ok(())
}
