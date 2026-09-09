use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::state::{PositionPDA, PositionState, RescueSessionPDA, SessionState};

#[derive(Accounts)]
pub struct ForceEvict<'info> {
    /// Permissionless caller (keeper, searcher, borrower, or public observer)
    pub caller: Signer<'info>,

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
}

pub fn force_evict(ctx: Context<ForceEvict>) -> Result<()> {
    let clock = Clock::get()?;
    let session = &mut ctx.accounts.session;
    let position = &mut ctx.accounts.position;

    // ─────────────────────────────────────────────────────────────────────────
    //  Invariant I7: Disjoint Slot Windows
    //  force_evict is valid ONLY if slot >= hard_cutoff_slot
    //  Guarantees finalize_rescue and force_evict can NEVER race in the same slot.
    // ─────────────────────────────────────────────────────────────────────────
    require!(
        clock.slot >= session.hard_cutoff_slot,
        RescueError::EvictionBeforeCutoff
    );

    // Can only evict sessions that were not settled
    require!(
        session.state != SessionState::Settled,
        RescueError::TerminalState
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  Invariant I5: Transition to Terminal Liquidatable State
    //  Fail-open liveness: Position is now unlocked and exposed to public MEV liquidation.
    // ─────────────────────────────────────────────────────────────────────────
    session.state = SessionState::Evicted;
    position.state = PositionState::Liquidatable;
    position.active_session = Pubkey::default();

    msg!(
        "Position FORCE EVICTED at slot {} past cutoff {}! State transitioned to LIQUIDATABLE.",
        clock.slot,
        session.hard_cutoff_slot
    );

    Ok(())
}
