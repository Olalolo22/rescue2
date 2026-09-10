// Rescue Protocol — On-Chain Constants & Network Parameters
// Verified against Solana Devnet & MagicBlock TEE Ephemeral Rollup

export const PROTOCOL_CONSTANTS = {
  PROGRAM_ID: "ZnDqdjHjR1HuwyMehcfEGrxCt6QiCz58UW21VjbnGjf",
  TEE_VALIDATOR: "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",
  DELEGATION_PROGRAM_ID: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
  PYTH_SOL_FEED: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4SEBy6",
  
  // RPC Endpoints
  RPC_SOLANA_DEVNET: "https://api.devnet.solana.com",
  RPC_MAGICBLOCK_TEE: "https://devnet-tee.magicblock.app",

  // Core Protocol Numerical Parameters (BPS = Basis Points, 100 bps = 1.00%)
  P_PUBLIC_BPS: 800,        // 8.00% standard public liquidation penalty
  P_RESERVE_CAP_BPS: 650,    // 6.50% reserve cap (guaranteed non-worseness)
  P_WINNING_BID_BPS: 250,    // 2.50% winning auction bid
  MIN_GUARANTEED_SAVINGS_BPS: 150, // 1.50% minimum borrower saving
  TARGET_HF_BPS: 12000,      // 1.20 target health factor post-rescue
  AUCTION_DURATION_SECONDS: 60,

  // Reference Position RP-0427-ALPHA
  INCIDENT_ID: "RP-0427-ALPHA",
  BORROWER_PUBKEY: "7xRscu...Borrower9qL1",
  COLLATERAL_SOL: 10.00,
  DEBT_USDC: 900.00,
  NORMAL_SOL_PRICE: 100.00,
  CRASH_SOL_PRICE: 82.00,
  LIQUIDATION_THRESHOLD: 86.00,
  CANONICAL_SETTLEMENT_TX: "3oJ6UfzqU8pwKCXVoFWVTzECRdU19vohdhZyo3wyVeWXCUvLS3b3aEDXMtv9coaxxuGxPBhs9SAq2E3VJQPz2WAq",

  // Invariants
  INVARIANTS: [
    {
      id: "I₁",
      title: "No Public Liquidation Race",
      description: "MEV searchers cannot seize borrower equity before intervention resolves.",
      verified: true,
    },
    {
      id: "I₆",
      title: "L1 Mutation Lock (Error 3007)",
      description: "Solana runtime deflects all L1 mutations with AccountOwnedByWrongProgram.",
      verified: true,
    },
    {
      id: "I₁₀",
      title: "Durable RescueRecord Anchor",
      description: "Settlement commits an immutable cryptographic receipt back to base Solana.",
      verified: true,
    },
  ],
} as const;
