use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::state::{RescueSessionPDA, SessionState};

#[derive(Accounts)]
pub struct SubmitBid<'info> {
    /// Rescuer submitting the sealed bid on TEE RPC
    pub bidder: Signer<'info>,

    #[account(
        mut,
        seeds = [
            RescueSessionPDA::SEED_PREFIX,
            session.position.as_ref(),
            &session.rescue_index.to_le_bytes()
        ],
        bump = session.bump
    )]
    pub session: Account<'info, RescueSessionPDA>,
}

pub fn submit_bid(ctx: Context<SubmitBid>, penalty_bps: u16, bond_committed: u64) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;

    // Check auction lifecycle
    require!(
        session.state == SessionState::AuctionOpen,
        RescueError::AuctionClosed
    );
    require!(
        clock.slot <= session.auction_end_slot,
        RescueError::AuctionClosed
    );

    // Invariant I1: Non-Worseness Reserve Cap
    // Every valid bid MUST be strictly <= P_reserve
    require!(
        penalty_bps <= session.p_reserve_bps,
        RescueError::BidExceedsReserve
    );

    // Invariant I3: Anti-Phantom Slashing Bond Check
    require!(
        bond_committed >= session.required_bond,
        RescueError::InsufficientBond
    );

    let bidder_key = ctx.accounts.bidder.key();

    // Reverse auction matching: Lowest penalty wins
    if session.winning_bidder == Pubkey::default() || penalty_bps < session.winning_penalty_bps {
        // Demote current winner to runner-up
        session.runner_up_bidder = session.winning_bidder;
        session.runner_up_penalty_bps = session.winning_penalty_bps;

        // Crown new winner
        session.winning_bidder = bidder_key;
        session.winning_penalty_bps = penalty_bps;
    } else if session.runner_up_bidder == Pubkey::default() || penalty_bps < session.runner_up_penalty_bps {
        // Update runner-up
        session.runner_up_bidder = bidder_key;
        session.runner_up_penalty_bps = penalty_bps;
    }

    msg!(
        "Bid accepted for session {}: bidder={}, penalty={} bps (current winner: {} at {} bps)",
        session.key(),
        bidder_key,
        penalty_bps,
        session.winning_bidder,
        session.winning_penalty_bps
    );

    Ok(())
}
