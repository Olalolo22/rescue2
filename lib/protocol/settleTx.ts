import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { PROTOCOL_CONSTANTS } from './constants'
import { KNOWN_PDAS } from './pda'

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export interface SettleTxResult {
  signature: string
  slot: number
  explorerUrl: string
}

export async function executeDevnetSettlementTx({
  provider,
  walletPubkey,
  incidentId,
  savedUsd,
  penaltyBps = 250,
}: {
  provider: any
  walletPubkey: string
  incidentId: string
  savedUsd: string
  penaltyBps?: number
}): Promise<SettleTxResult> {
  const connection = new Connection(PROTOCOL_CONSTANTS.RPC_SOLANA_DEVNET, 'confirmed')
  const payer = new PublicKey(walletPubkey)

  // 1. Fetch latest blockhash from Solana Devnet
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

  // 2. Structured cryptographic settlement proof data
  const memoText = `RESCUE:settle:${incidentId}:penalty=${penaltyBps}bps:saved=$${savedUsd}:record=${KNOWN_PDAS.RESCUE_RECORD_0427}:status=CONFIRMED`
  const memoData = Buffer.from(memoText, 'utf-8')

  const memoInstruction = new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: memoData,
  })

  const tx = new Transaction()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer
  tx.add(memoInstruction)

  // 3. Request wallet signature
  let signature: string
  if (typeof provider.signAndSendTransaction === 'function') {
    const res = await provider.signAndSendTransaction(tx)
    signature = typeof res === 'string' ? res : res.signature
  } else if (typeof provider.signTransaction === 'function') {
    const signedTx = await provider.signTransaction(tx)
    signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })
  } else {
    throw new Error('Connected wallet does not support signing transactions.')
  }

  // 4. Confirm transaction on Solana Devnet
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  )

  const slot = confirmation.context.slot

  return {
    signature,
    slot,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  }
}
