use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral, ephemeral_accounts};
use ephemeral_rollups_sdk::access_control::{
    instructions::CreateEphemeralPermissionCpi,
    structs::{
        EphemeralMembersArgs, EphemeralPermission, Member, PERMISSION_SEED,
        ACCOUNT_SIGNATURES_FLAG, AUTHORITY_FLAG, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG,
    },
};
use ephemeral_rollups_sdk::consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_rollups_sdk::id as dlp_id;

declare_id!("ZnDqdjHjR1HuwyMehcfEGrxCt6QiCz58UW21VjbnGjf");

pub const PROBE_SEED: &[u8] = b"probe";
pub const EPHEMERAL_SEED: &[u8] = b"ephemeral_item";

#[error_code]
pub enum ProbeError {
    #[msg("Caller is not authorized to read or mutate this probe (6013)")]
    CrossReadDenied,
    #[msg("Account is already delegated to DLP")]
    AlreadyDelegated,
    #[msg("Account is not delegated to DLP")]
    NotDelegated,
}

#[ephemeral]
#[program]
pub mod probe {
    use super::*;

    /// 1. Initialize a base ProbeAccount PDA.
    /// Can allocate extra lamports for EphemeralPermission rent on ER if needed.
    pub fn initialize_probe(ctx: Context<InitializeProbe>, extra_rent_members: u8) -> Result<()> {
        // Capture account infos BEFORE the mutable borrow to avoid E0502
        let probe_account_info = ctx.accounts.probe.to_account_info();
        let payer_account_info = ctx.accounts.payer.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();

        let probe = &mut ctx.accounts.probe;
        probe.authority = ctx.accounts.authority.key();
        probe.counter = 0;
        probe.bump = ctx.bumps.probe;

        if extra_rent_members > 0 {
            // Pre-fund rent for EphemeralPermission sizing (e.g. 1 or 2 members) + 10M lamports buffer
            let rent_lamports = ephemeral_rollups_sdk::ephemeral_accounts::rent(
                EphemeralPermission::size_of(extra_rent_members as usize) as u32,
            ) + 10_000_000;
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    system_program_info.key(),
                    anchor_lang::system_program::Transfer {
                        from: payer_account_info,
                        to: probe_account_info,
                    },
                ),
                rent_lamports,
            )?;
            msg!(
                "Pre-funded {} lamports for {} member permission",
                rent_lamports,
                extra_rent_members
            );
        }

        msg!("Probe account initialized: authority={}", probe.authority);
        Ok(())
    }

    /// 2. Delegate ProbeAccount to MagicBlock DLP / TEE validator.
    pub fn delegate_probe(ctx: Context<DelegateProbe>) -> Result<()> {
        if ctx.accounts.probe.owner != &dlp_id() {
            let validator = ctx.accounts.validator.as_ref().map(|v| v.key());
            ctx.accounts.delegate_probe(
                &ctx.accounts.payer,
                &[PROBE_SEED, ctx.accounts.authority.key().as_ref()],
                DelegateConfig {
                    validator,
                    ..Default::default()
                },
            )?;
            msg!("Probe delegated successfully to validator: {:?}", validator);
        } else {
            msg!("Probe already delegated to DLP");
        }
        Ok(())
    }

    /// 3. Normal mutation: Increments counter.
    /// Used for Probe 3: Calling this on base layer while delegated fails with 3007 (AccountOwnedByWrongProgram).
    pub fn mutate_probe(ctx: Context<MutateProbe>, increment: u64) -> Result<()> {
        let probe = &mut ctx.accounts.probe;
        probe.counter = probe.counter.checked_add(increment).unwrap();
        msg!("Probe mutated: new counter={}", probe.counter);
        Ok(())
    }

    /// 4. Liquidate simulation: An unprivileged caller attempts liquidation.
    /// Used for Probe 6: Proves MEV searchers get 3007 on delegated positions.
    pub fn liquidate_probe(ctx: Context<LiquidateProbe>) -> Result<()> {
        let probe = &mut ctx.accounts.probe;
        probe.counter = 0;
        msg!("Probe liquidated by {}", ctx.accounts.liquidator.key());
        Ok(())
    }

    /// 5. Create EphemeralPermission on TEE ER for access control.
    /// Used for Probe 1: Testing if multi-member (e.g. 2 members) permission works on current TEE.
    pub fn init_probe_permission(
        ctx: Context<InitProbePermission>,
        is_private: bool,
        members: Vec<Pubkey>,
    ) -> Result<()> {
        if ctx.accounts.permission.lamports() > 0 {
            msg!("Permission account already exists");
            return Ok(());
        }

        let authority_key = ctx.accounts.authority.key();
        let probe_bump = ctx.accounts.probe.bump;
        let signers = [
            PROBE_SEED,
            authority_key.as_ref(),
            &[probe_bump],
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
            payer: ctx.accounts.probe.to_account_info(),
            permissioned_account: ctx.accounts.probe.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private,
                members: member_structs,
            },
        }
        .invoke_signed(&[&signers])?;

        msg!("EphemeralPermission created successfully");
        Ok(())
    }

    /// 6. Cross-read probe: Enforces on-chain permission check.
    /// Used for CrossReadDenied (6013) verification.
    pub fn probe_cross_read(ctx: Context<ProbeCrossReadAccounts>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.reader.key(),
            ctx.accounts.probe.authority,
            ProbeError::CrossReadDenied
        );
        msg!("Cross-read authorized for authority {}", ctx.accounts.reader.key());
        Ok(())
    }

    /// 7. Program CPI Undelegate: Initiates commit & undelegation back to base layer.
    /// Used for Probe 2: Measures latency until base ownership returns to program.
    pub fn undelegate_probe(ctx: Context<UndelegateProbe>) -> Result<()> {
        msg!("Undelegate probe committing account to base layer...");
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.probe.to_account_info()])
        .build_and_invoke()?;

        msg!("CPI undelegate invoked successfully");
        Ok(())
    }

    /// 8. Create an ephemeral account directly on ER (no base footprint).
    /// Used for Probe 7: Testing ephemeral account lifecycle.
    pub fn create_ephemeral_item(ctx: Context<CreateEphemeralItem>, data: u64) -> Result<()> {
        ctx.accounts
            .create_ephemeral_item(EphemeralItemAccount::LEN as u32)?;

        let (_, bump) = Pubkey::find_program_address(
            &[EPHEMERAL_SEED, ctx.accounts.authority.key().as_ref()],
            &crate::id(),
        );

        let item = EphemeralItemAccount {
            authority: ctx.accounts.authority.key(),
            data,
            bump,
        };
        let mut account_data = ctx.accounts.item.try_borrow_mut_data()?;
        let mut writer = &mut account_data[..];
        item.try_serialize(&mut writer)?;
        msg!("Ephemeral item created on ER: data={}", data);
        Ok(())
    }

    /// 9. Close an ephemeral account on ER.
    /// Used for Probe 7: Verifying complete cleanup on ER with 0 trace on L1.
    pub fn close_ephemeral_item(ctx: Context<CloseEphemeralItem>) -> Result<()> {
        ctx.accounts.close_ephemeral_item()?;
        msg!(
            "Ephemeral item closed on ER. Rent refunded to {}",
            ctx.accounts.authority.key()
        );
        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Account Structs & Contexts
// -----------------------------------------------------------------------------

#[account]
#[derive(Default)]
pub struct ProbeAccount {
    pub authority: Pubkey,
    pub counter: u64,
    pub bump: u8,
}

impl ProbeAccount {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[account]
#[derive(Default)]
pub struct EphemeralItemAccount {
    pub authority: Pubkey,
    pub data: u64,
    pub bump: u8,
}

impl EphemeralItemAccount {
    pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[derive(Accounts)]
pub struct InitializeProbe<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = ProbeAccount::LEN + 128, // extra room for rent tests
        seeds = [PROBE_SEED, authority.key().as_ref()],
        bump
    )]
    pub probe: Account<'info, ProbeAccount>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateProbe<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    /// CHECK: PDA seeds verified; del attribute handles delegation CPI
    #[account(
        mut,
        del,
        seeds = [PROBE_SEED, authority.key().as_ref()],
        bump
    )]
    pub probe: UncheckedAccount<'info>,
    /// CHECK: Optional TEE/ER validator identity
    pub validator: Option<UncheckedAccount<'info>>,
}

#[derive(Accounts)]
pub struct MutateProbe<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PROBE_SEED, authority.key().as_ref()],
        bump = probe.bump
    )]
    pub probe: Account<'info, ProbeAccount>,
}

#[derive(Accounts)]
pub struct LiquidateProbe<'info> {
    pub liquidator: Signer<'info>,
    /// CHECK: Target probe authority
    pub authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [PROBE_SEED, authority.key().as_ref()],
        bump = probe.bump
    )]
    pub probe: Account<'info, ProbeAccount>,
}

#[derive(Accounts)]
pub struct InitProbePermission<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PROBE_SEED, authority.key().as_ref()],
        bump = probe.bump
    )]
    pub probe: Account<'info, ProbeAccount>,
    /// CHECK: permission PDA verified by seeds
    #[account(
        mut,
        seeds = [PERMISSION_SEED, probe.key().as_ref()],
        bump,
        seeds::program = PERMISSION_PROGRAM_ID,
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: MagicBlock ephemeral vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: MagicBlock magic program
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: MagicBlock permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ProbeCrossReadAccounts<'info> {
    pub reader: Signer<'info>,
    #[account(
        seeds = [PROBE_SEED, probe.authority.as_ref()],
        bump = probe.bump
    )]
    pub probe: Account<'info, ProbeAccount>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateProbe<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: delegated probe PDA
    #[account(mut)]
    pub probe: UncheckedAccount<'info>,
    /// CHECK: MagicBlock context account
    #[account(mut)]
    pub magic_context: UncheckedAccount<'info>,
    /// CHECK: MagicBlock magic program
    pub magic_program: UncheckedAccount<'info>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct CreateEphemeralItem<'info> {
    #[account(mut, sponsor)]
    pub authority: Signer<'info>,
    /// CHECK: Ephemeral item PDA created on ER
    #[account(
        mut,
        eph,
        seeds = [EPHEMERAL_SEED, authority.key().as_ref()],
        bump
    )]
    pub item: UncheckedAccount<'info>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct CloseEphemeralItem<'info> {
    #[account(mut, sponsor)]
    pub authority: Signer<'info>,
    /// CHECK: Ephemeral item PDA closed on ER
    #[account(
        mut,
        eph,
        seeds = [EPHEMERAL_SEED, authority.key().as_ref()],
        bump
    )]
    pub item: UncheckedAccount<'info>,
}
