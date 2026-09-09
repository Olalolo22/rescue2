use crate::errors::RescueError;
use anchor_lang::prelude::*;

/// Precision scale for basis points: 10_000 = 100.00%
pub const BPS_SCALE: u128 = 10_000;

/// Precision scale for price feeds (6 decimals): 1_000_000 = $1.000000
pub const PRICE_SCALE: u128 = 1_000_000;

/// Precision scale for Health Factor (10_000 = 1.0000)
pub const HF_SCALE: u128 = 10_000;

/// Calculate current Health Factor in HF_SCALE units (10_000 = 1.00).
///
/// HF = (Collateral * Price * LiquidationThreshold) / Debt
pub fn compute_health_factor(
    collateral: u64,
    debt: u64,
    price: i64,
    lt_bps: u32,
) -> Result<u64> {
    if debt == 0 {
        return Ok(u64::MAX);
    }
    if price <= 0 || collateral == 0 {
        return Ok(0);
    }

    let c = collateral as u128;
    let d = debt as u128;
    let p = price as u128;
    let lt = lt_bps as u128;

    // collateral_value_debt_units = (c * p) / PRICE_SCALE
    // max_borrowable = (collateral_value_debt_units * lt) / BPS_SCALE
    // hf = (max_borrowable * HF_SCALE) / d

    let num = c
        .checked_mul(p)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(lt)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(HF_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    let den = d
        .checked_mul(PRICE_SCALE)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(BPS_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    if den == 0 {
        return err!(RescueError::MathOverflow);
    }

    let hf = num / den;
    Ok(hf as u64)
}

/// Computes the minimal debt repayment R_min needed to restore HF to target_hf (Invariant I2).
///
/// Formula (settled in ARCHITECTURE.md §20):
///   R_min = ceil( (HF* * D0 - C0 * p * LT) / (HF* - (1 + P) * LT) )
///
/// Returns R_min in debt asset native precision.
pub fn compute_r_min(
    collateral_0: u64,
    debt_0: u64,
    price: i64,
    lt_bps: u32,
    target_hf_bps: u32,
    penalty_bps: u16,
) -> Result<u64> {
    require!(price > 0, RescueError::InvalidOraclePrice);

    let c0 = collateral_0 as u128;
    let d0 = debt_0 as u128;
    let p = price as u128;
    let lt = lt_bps as u128;          // out of BPS_SCALE (10_000)
    let hf_star = target_hf_bps as u128; // out of HF_SCALE (10_000)
    let p_pen = penalty_bps as u128;    // out of BPS_SCALE (10_000)

    // Term 1: HF* * D0
    // Scales: hf_star (10_000), d0 (native), lt (10_000), p (1_000_000)
    // Common unit base: scaled by (HF_SCALE * BPS_SCALE * PRICE_SCALE)

    // Numerator: HF* * D0 - C0 * p * LT
    // In units of (debt_units * HF_SCALE * BPS_SCALE * PRICE_SCALE):
    let hf_d0 = hf_star
        .checked_mul(d0)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(BPS_SCALE)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(PRICE_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    let c0_p_lt = c0
        .checked_mul(p)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(lt)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(HF_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    if hf_d0 <= c0_p_lt {
        // Position is already above or at target HF
        return Ok(0);
    }

    let num = hf_d0 - c0_p_lt;

    // Denominator: HF* - (1 + P) * LT
    // In dimensionless scale (HF_SCALE * BPS_SCALE * PRICE_SCALE):
    // HF* / HF_SCALE - (BPS_SCALE + P) * LT / (BPS_SCALE * BPS_SCALE)
    // Bring both to common denominator (HF_SCALE * BPS_SCALE * BPS_SCALE):
    let den_term1 = hf_star
        .checked_mul(BPS_SCALE)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(BPS_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    let one_plus_p = BPS_SCALE
        .checked_add(p_pen)
        .ok_or(RescueError::MathOverflow)?;

    let den_term2 = one_plus_p
        .checked_mul(lt)
        .ok_or(RescueError::MathOverflow)?
        .checked_mul(HF_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    require!(den_term1 > den_term2, RescueError::MathOverflow);
    let den_scale = den_term1 - den_term2;

    // Since num is scaled by (HF_SCALE * BPS_SCALE * PRICE_SCALE)
    // and den_scale is scaled by (HF_SCALE * BPS_SCALE * BPS_SCALE),
    // result = ceil( (num * BPS_SCALE) / (den_scale * PRICE_SCALE) )

    let scaled_num = num
        .checked_mul(BPS_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    let scaled_den = den_scale
        .checked_mul(PRICE_SCALE)
        .ok_or(RescueError::MathOverflow)?;

    // Ceiling division
    let r_min = (scaled_num + scaled_den - 1) / scaled_den;

    // Safety Valve: 50% close factor max
    let max_repayment = d0 / 2;
    require!(r_min <= max_repayment, RescueError::CloseFactorExceeded);

    Ok(r_min as u64)
}

/// Compute required anti-phantom slashing bond (Invariant I3).
///
/// Bond = max(min_bond, r_min * bond_pct_bps / 10_000)
pub fn compute_required_bond(
    r_min: u64,
    bond_pct_bps: u16,
    min_bond: u64,
) -> Result<u64> {
    let pct_bond = (r_min as u128)
        .checked_mul(bond_pct_bps as u128)
        .ok_or(RescueError::MathOverflow)?
        / BPS_SCALE;

    let required = std::cmp::max(pct_bond as u64, min_bond);
    Ok(required)
}

/// Verifies oracle price drift tolerance between TEE match and L1 finalize (Invariant I8).
///
/// Returns Ok(()) if p_l1 >= p_match * (10_000 - max_drift_bps) / 10_000
pub fn verify_price_drift(
    price_at_match: i64,
    price_at_finalize: i64,
    max_drift_bps: u16,
) -> Result<()> {
    require!(price_at_match > 0 && price_at_finalize > 0, RescueError::InvalidOraclePrice);

    // If price went up or stayed flat, drift is in borrower's favor
    if price_at_finalize >= price_at_match {
        return Ok(());
    }

    let p_match = price_at_match as u128;
    let p_l1 = price_at_finalize as u128;
    let max_drop = BPS_SCALE.checked_sub(max_drift_bps as u128).ok_or(RescueError::MathOverflow)?;

    // Check: p_l1 * BPS_SCALE >= p_match * (10_000 - max_drift_bps)
    let min_allowed_p = p_match
        .checked_mul(max_drop)
        .ok_or(RescueError::MathOverflow)?
        / BPS_SCALE;

    require!(p_l1 >= min_allowed_p, RescueError::PriceDriftExceeded);
    Ok(())
}

/// Compute collateral to be seized for repaying `repaid_amount` of debt at `penalty_bps`.
///
/// Collateral seized = (repaid_debt * (1 + penalty) * PRICE_SCALE) / price
pub fn compute_collateral_seized(
    repaid_amount: u64,
    penalty_bps: u16,
    price: i64,
) -> Result<u64> {
    require!(price > 0, RescueError::InvalidOraclePrice);

    let repay = repaid_amount as u128;
    let pen = penalty_bps as u128;
    let p = price as u128;

    let effective_repay = repay
        .checked_mul(BPS_SCALE + pen)
        .ok_or(RescueError::MathOverflow)?
        / BPS_SCALE;

    let collateral_seized = effective_repay
        .checked_mul(PRICE_SCALE)
        .ok_or(RescueError::MathOverflow)?
        / p;

    Ok(collateral_seized as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_factor_calculation() {
        // 10 SOL ($150 each) = $1,500 collateral value
        // LT = 80% (8,000 bps) -> max borrow = $1,200
        // Debt = $1,000
        // HF should be 1.20 (12,000)
        let collateral = 10_000_000_000; // 10 SOL (9 decimals, wait price scale is 6)
        let debt = 1_000_000_000;       // 1,000 USDC (6 decimals)
        let price = 150_000_000;         // $150.000000
        let lt_bps = 8_000;

        // If c is 10 units, p is $150, d is $1000:
        // HF = (10 * 150 * 0.8) / 1000 = 1200 / 1000 = 1.20
        let hf = compute_health_factor(10, 1000, 150_000_000, lt_bps).unwrap();
        assert_eq!(hf, 12_000);
    }

    #[test]
    fn test_r_min_formula() {
        // C0 = 10 SOL, p = $100 -> Value = $1,000
        // LT = 80% (8000 bps)
        // D0 = $900 -> HF = 800 / 900 = 0.8888 (Underwater/At-risk)
        // Target HF = 1.20 (12000 bps)
        // Penalty = 2.5% (250 bps)
        let c0 = 10;
        let d0 = 900;
        let price = 100_000_000; // $100
        let lt = 8000;
        let target_hf = 12000;
        let pen = 250;

        let r_min = compute_r_min(c0, d0, price, lt, target_hf, pen).unwrap();
        // R_min must be positive and <= 450 (50% close factor)
        assert!(r_min > 0);
        assert!(r_min <= 450);
    }

    #[test]
    fn test_drift_guard() {
        let p_match = 100_000_000; // $100
        // 1.5% drop = $98.5
        let p_ok = 98_500_000;
        let p_bad = 98_400_000;

        assert!(verify_price_drift(p_match, p_ok, 150).is_ok());
        assert!(verify_price_drift(p_match, p_bad, 150).is_err());
    }
}
