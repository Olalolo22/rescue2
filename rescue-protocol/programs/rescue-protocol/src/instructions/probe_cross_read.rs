use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::state::RescueSessionPDA;

#[derive(Accounts)]
pub struct ProbeCrossRead<'info> {
    /// Caller attempting to read the private auction state
    pub reader: Signer<'info>,

    #[account(
        seeds = [
            RescueSessionPDA::SEED_PREFIX,
            session.position.as_ref(),
            &session.rescue_index.to_le_bytes()
        ],
        bump = session.bump
    )]
    pub session: Account<'info, RescueSessionPDA>,
}

pub fn probe_cross_read(ctx: Context<ProbeCrossRead>) -> Result<()> {
    // Only the winning bidder or runner-up is authorized to inspect matched auction internals
    let is_authorized = ctx.accounts.reader.key() == ctx.accounts.session.winning_bidder
        || ctx.accounts.reader.key() == ctx.accounts.session.runner_up_bidder;

    require!(is_authorized, RescueError::CrossReadDenied);

    msg!(
        "Cross-read authorized for member {}",
        ctx.accounts.reader.key()
    );
    Ok(())
}
