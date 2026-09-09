use anchor_lang::prelude::*;
use crate::state::RescueConfigPDA;

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = RescueConfigPDA::SPACE,
        seeds = [RescueConfigPDA::SEED_PREFIX],
        bump
    )]
    pub config: Account<'info, RescueConfigPDA>,

    pub system_program: Program<'info, System>,
}

pub fn init_config(
    ctx: Context<InitConfig>,
    reserve_spread_bps: u16,
    bond_pct_bps: u16,
    min_bond_amount: u64,
    max_drift_bps: u16,
    rescue_window_slots: u64,
    settlement_window_slots: u64,
    runner_up_window_slots: u64,
    target_hf_bps: u32,
    cooldown_slots: u64,
    liquidation_threshold_bps: u32,
    public_penalty_bps: u16,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.reserve_spread_bps = reserve_spread_bps;
    config.bond_pct_bps = bond_pct_bps;
    config.min_bond_amount = min_bond_amount;
    config.max_drift_bps = max_drift_bps;
    config.rescue_window_slots = rescue_window_slots;
    config.settlement_window_slots = settlement_window_slots;
    config.runner_up_window_slots = runner_up_window_slots;
    config.target_hf_bps = target_hf_bps;
    config.cooldown_slots = cooldown_slots;
    config.liquidation_threshold_bps = liquidation_threshold_bps;
    config.public_penalty_bps = public_penalty_bps;
    config.bump = ctx.bumps.config;

    msg!("RescueConfig initialized with admin={}", config.admin);
    Ok(())
}
