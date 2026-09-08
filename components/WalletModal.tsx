'use client'

import React from 'react'
import { X, ExternalLink, ShieldCheck, Zap } from 'lucide-react'
import { useSolanaWallet } from '@/lib/wallet/WalletContext'
import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'

export function WalletModal() {
  const { isModalOpen, closeModal, connect } = useSolanaWallet()

  if (!isModalOpen) return null

  return (
    <div 
      className="modal-backdrop" 
      role="dialog" 
      aria-modal="true"
      style={{ zIndex: 9999 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal() }}
    >
      <div className="record-modal" style={{ maxWidth: 440, borderColor: 'var(--purple)' }}>
        <button className="close-button" onClick={closeModal} aria-label="Close">
          <X size={18} />
        </button>

        <div className="record-seal" style={{ borderColor: 'var(--purple)', color: 'var(--purple)' }}>
          <ShieldCheck size={23} />
        </div>

        <div className="eyebrow purple-eyebrow">SOLANA DEVNET WALLET</div>
        <h3>Connect to Rescue</h3>
        <p className="record-copy">
          Connect your Solana wallet to inspect real-time Devnet positions or sign live intervention probes.
        </p>

        <div style={{ display: 'grid', gap: '10px', marginTop: '22px' }}>
          {/* Phantom */}
          <button
            onClick={() => connect('phantom')}
            className="subtle-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid #36324e',
              background: '#151224',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ab9ff2' }} />
              Phantom Wallet
            </span>
            <span style={{ fontSize: '10px', color: 'var(--purple)', fontFamily: 'var(--font-data)' }}>
              DETECT
            </span>
          </button>

          {/* Solflare */}
          <button
            onClick={() => connect('solflare')}
            className="subtle-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid #36324e',
              background: '#151224',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fc7227' }} />
              Solflare Wallet
            </span>
            <span style={{ fontSize: '10px', color: 'var(--purple)', fontFamily: 'var(--font-data)' }}>
              DETECT
            </span>
          </button>

          {/* Pilot Mode (Instant Testnet Key for Judges) */}
          <button
            onClick={closeModal}
            className="subtle-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid #275240',
              background: '#0d1d17',
              color: 'var(--green)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Zap size={14} />
              Instant Devnet Pilot Mode
            </span>
            <span style={{ fontSize: '10px', color: 'var(--green)', fontFamily: 'var(--font-data)' }}>
              PRE-FUNDED
            </span>
          </button>
        </div>

        <div style={{ marginTop: '20px', fontSize: '11px', color: '#7a8594', display: 'flex', justifyContent: 'space-between' }}>
          <span>Don&apos;t have a wallet?</span>
          <a 
            href="https://phantom.app" 
            target="_blank" 
            rel="noreferrer"
            style={{ color: 'var(--purple)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Install Phantom <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}
