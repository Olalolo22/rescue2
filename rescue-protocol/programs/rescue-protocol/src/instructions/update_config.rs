use anchor_lang::prelude::*;
use crate::state::RescueConfigPDA;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [RescueConfigPDA::SEED_PREFIX],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, RescueConfigPDA>,
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    reserve_spread_bps: Option<u16>,
    bond_pct_bps: Option<u16>,
    min_bond_amount: Option<u64>,
    max_drift_bps: Option<u16>,
    rescue_window_slots: Option<u64>,
    settlement_window_slots: Option<u64>,
    runner_up_window_slots: Option<u64>,
    target_hf_bps: Option<u32>,
    cooldown_slots: Option<u64>,
    liquidation_threshold_bps: Option<u32>,
    public_penalty_bps: Option<u16>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(v) = reserve_spread_bps { config.reserve_spread_bps = v; }
    if let Some(v) = bond_pct_bps { config.bond_pct_bps = v; }
    if let Some(v) = min_bond_amount { config.min_bond_amount = v; }
    if let Some(v) = max_drift_bps { config.max_drift_bps = v; }
    if let Some(v) = rescue_window_slots { config.rescue_window_slots = v; }
    if let Some(v) = settlement_window_slots { config.settlement_window_slots = v; }
    if let Some(v) = runner_up_window_slots { config.runner_up_window_slots = v; }
    if let Some(v) = target_hf_bps { config.target_hf_bps = v; }
    if let Some(v) = cooldown_slots { config.cooldown_slots = v; }
    if let Some(v) = liquidation_threshold_bps { config.liquidation_threshold_bps = v; }
    if let Some(v) = public_penalty_bps { config.public_penalty_bps = v; }

    msg!("RescueConfig updated by admin={}", ctx.accounts.admin.key());
    Ok(())
}
