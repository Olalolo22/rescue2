use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::{
    instructions::CreateEphemeralPermissionCpi,
    structs::{
        EphemeralMembersArgs, Member,
        ACCOUNT_SIGNATURES_FLAG, AUTHORITY_FLAG, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG,
    },
};

use crate::state::RescueSessionPDA;

#[derive(Accounts)]
pub struct InitBidPermission<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub session: Account<'info, RescueSessionPDA>,

    /// CHECK: EphemeralPermission account derived on ER
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,

    /// CHECK: Ephemeral vault
    pub ephemeral_vault: UncheckedAccount<'info>,

    /// CHECK: MagicBlock Magic Program
    pub magic_program: UncheckedAccount<'info>,

    /// CHECK: MagicBlock Permission Program
    pub permission_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn init_bid_permission(
    ctx: Context<InitBidPermission>,
    members: Vec<Pubkey>,
) -> Result<()> {
    if ctx.accounts.permission.lamports() > 0 {
        msg!("Permission account already exists on ER");
        return Ok(());
    }

    let session_key = ctx.accounts.session.key();
    let session_bump = ctx.accounts.session.bump;
    let signers: &[&[u8]] = &[
        RescueSessionPDA::SEED_PREFIX,
        ctx.accounts.session.position.as_ref(),
        &ctx.accounts.session.rescue_index.to_le_bytes(),
        &[session_bump],
    ];

    let member_structs: Vec<Member> = members
        .into_iter()
        .map(|pubkey| Member {
            flags: AUTHORITY_FLAG
                | TX_LOGS_FLAG
                | TX_BALANCES_FLAG
                | TX_MESSAGE_FLAG
                | ACCOUNT_SIGNATURES_FLAG,
            pubkey,
        })
        .collect();

    CreateEphemeralPermissionCpi {
        payer: ctx.accounts.session.to_account_info(),
        permissioned_account: ctx.accounts.session.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        args: EphemeralMembersArgs {
            is_private: true,
            members: member_structs,
        },
    }
    .invoke_signed(&[signers])?;

    msg!("EphemeralPermission created on ER for session {}", session_key);
    Ok(())
}
