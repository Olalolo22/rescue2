use anchor_lang::prelude::*;

#[error_code]
pub enum RescueError {
    // ── Invariant I1: Non-Worseness ─────────────────────────────────────────
    #[msg("Bid penalty exceeds P_reserve = P_public - spread. Non-worseness violated (I1).")]
    BidExceedsReserve,

    // ── Invariant I2: Minimal Right-Sizing ──────────────────────────────────
    #[msg("Repayment amount exceeds maximum allowed close factor (50% safety valve).")]
    CloseFactorExceeded,

    #[msg("Post-rescue Health Factor is below the required target (I2).")]
    PostRescueHfInsufficient,

    // ── Invariant I3: Anti-Phantom Bids ─────────────────────────────────────
    #[msg("Provided slashing bond is below the required minimum (I3).")]
    InsufficientBond,

    // ── Invariant I5: One-Way Terminal States ───────────────────────────────
    #[msg("Position is in a terminal state (Liquidatable) and cannot re-enter intervention (I5).")]
    TerminalState,

    // ── Invariant I6: Post-Rescue Cooldown ──────────────────────────────────
    #[msg("Position is in post-rescue cooldown period (I6).")]
    CooldownActive,

    // ── Invariant I7: Deterministic Eviction (Disjoint Slots) ────────────────
    #[msg("Finalization attempted after hard cutoff slot. Eviction window is active (I7).")]
    FinalizePastCutoff,

    #[msg("Force eviction attempted before hard cutoff slot. Finalize window is active (I7).")]
    EvictionBeforeCutoff,

    // ── Invariant I8: Oracle Drift Guard ────────────────────────────────────
    #[msg("Collateral price dropped beyond tolerance between auction match and finalization (I8).")]
    PriceDriftExceeded,

    // ── Invariant I10: MEV Exclusion ────────────────────────────────────────
    #[msg("Base layer liquidation blocked while PositionPDA is delegated (I10).")]
    InterventionZoneActive,

    // ── State Machine & Auction Errors ──────────────────────────────────────
    #[msg("Position health factor is not below AT_RISK threshold.")]
    PositionNotAtRisk,

    #[msg("Position is not in Healthy state.")]
    PositionNotHealthy,

    #[msg("Position is already in intervention zone.")]
    AlreadyInInterventionZone,

    #[msg("Rescue auction is still accepting bids.")]
    AuctionStillOpen,

    #[msg("Rescue auction has already concluded.")]
    AuctionClosed,

    #[msg("Session is not in Matched state.")]
    SessionNotMatched,

    #[msg("Caller is not authorized to settle this auction session.")]
    UnauthorizedSettler,

    #[msg("Exclusive settlement window has expired for this bidder.")]
    SettlementWindowExpired,

    #[msg("Math overflow or division by zero.")]
    MathOverflow,

    #[msg("Invalid oracle price feed data.")]
    InvalidOraclePrice,

    #[msg("Caller is not authorized to read or mutate this private ER auction state (6013).")]
    CrossReadDenied,
}
