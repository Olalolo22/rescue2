use anchor_lang::prelude::*;

/// Lifecycle of a rescue auction session.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum SessionState {
    /// Sealed-bid auction is live on the TEE.
    AuctionOpen,
    /// Bidding closed; lowest valid penalty selected. Waiting for L1 settlement.
    Matched,
    /// Winner (or runner-up) successfully executed flash repay on L1. Complete.
    Settled,
    /// Auction closed with no bids below P_reserve, or settlement failed.
    TimedOut,
    /// Eviction triggered via L1 fallback. Position unlocked to Liquidatable.
    Evicted,
}

/// Rescue auction session coordinating TEE bidding and L1 atomic settlement.
///
/// Seeds: [b"session", position.key().as_ref(), rescue_index.to_le_bytes()]
#[account]
#[derive(Debug)]
pub struct RescueSessionPDA {
    /// The lending position being rescued.
    pub position: Pubkey,

    /// Sequential rescue index for this position.
    pub rescue_index: u16,

    /// Current session status.
    pub state: SessionState,

    /// Slot when the rescue session was initiated on L1.
    pub start_slot: u64,

    /// Slot when the TEE sealed-bid auction closes.
    pub auction_end_slot: u64,

    /// Slot deadline for the winning bidder's exclusive settlement window.
    pub winner_settlement_deadline: u64,

    /// Slot deadline for the runner-up's settlement window (if winner defaults).
    pub runner_up_settlement_deadline: u64,

    /// Absolute hard cutoff slot after which `force_evict` is callable (I7).
    /// Disjoint slot interval:
    ///   finalize_rescue valid ONLY if slot < hard_cutoff_slot
    ///   force_evict valid ONLY if slot >= hard_cutoff_slot
    pub hard_cutoff_slot: u64,

    /// Minimal debt repayment required to restore position to target HF (I2).
    pub r_min: u64,

    /// Required slashing bond amount in debt token units (I3).
    pub required_bond: u64,

    /// Maximum allowable winning penalty (bps). Enforces non-worseness (I1).
    pub p_reserve_bps: u16,

    /// Collateral price at the time the auction was matched (6 decimals).
    /// Used by L1 finalize instruction to enforce drift tolerance (I8).
    pub price_at_match: i64,

    /// Selected winning bidder.
    pub winning_bidder: Pubkey,

    /// Winning penalty (bps). Guaranteed to be <= p_reserve_bps.
    pub winning_penalty_bps: u16,

    /// Runner-up bidder (cascaded if winner fails to settle within window).
    pub runner_up_bidder: Pubkey,

    /// Runner-up penalty (bps).
    pub runner_up_penalty_bps: u16,

    /// PDA bump.
    pub bump: u8,
}

impl RescueSessionPDA {
    pub const SPACE: usize = 8      // discriminator
        + 32                         // position
        + 2                          // rescue_index
        + 1                          // state (enum tag)
        + 8                          // start_slot
        + 8                          // auction_end_slot
        + 8                          // winner_settlement_deadline
        + 8                          // runner_up_settlement_deadline
        + 8                          // hard_cutoff_slot
        + 8                          // r_min
        + 8                          // required_bond
        + 2                          // p_reserve_bps
        + 8                          // price_at_match
        + 32                         // winning_bidder
        + 2                          // winning_penalty_bps
        + 32                         // runner_up_bidder
        + 2                          // runner_up_penalty_bps
        + 1;                         // bump

    pub const SEED_PREFIX: &'static [u8] = b"session";
}
