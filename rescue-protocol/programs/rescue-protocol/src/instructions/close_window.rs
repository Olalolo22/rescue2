use anchor_lang::prelude::*;
use crate::errors::RescueError;
use crate::state::{RescueSessionPDA, SessionState};

#[derive(Accounts)]
pub struct CloseWindow<'info> {
    /// Keeper or caller closing the auction window
    pub caller: Signer<'info>,

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

pub fn close_window(ctx: Context<CloseWindow>, current_price: i64) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;

    require!(
        session.state == SessionState::AuctionOpen,
        RescueError::AuctionClosed
    );

    // Cannot close before the bidding window has fully elapsed
    require!(
        clock.slot >= session.auction_end_slot,
        RescueError::AuctionStillOpen
    );

    if session.winning_bidder != Pubkey::default() {
        // Auction succeeded: We have a winner with penalty <= P_reserve
        session.state = SessionState::Matched;
        session.price_at_match = current_price;

        msg!(
            "Rescue auction matched! Winner: {}, Penalty: {} bps, Match Price: {}",
            session.winning_bidder,
            session.winning_penalty_bps,
            current_price
        );
    } else {
        // No valid bids submitted under P_reserve: Auction times out
        session.state = SessionState::TimedOut;

        msg!(
            "Rescue auction timed out without valid bids. Session: {}",
            session.key()
        );
    }

    Ok(())
}
