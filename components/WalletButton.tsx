'use client'

import React from 'react'
import { useSolanaWallet } from '@/lib/wallet/WalletContext'
import { Wallet, LogOut } from 'lucide-react'

export function WalletButton({ className = '' }: { className?: string }) {
  const { publicKey, connected, connecting, walletName, balanceSol, openModal, disconnect } = useSolanaWallet()

  const truncatedKey = publicKey
    ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
    : null

  if (connecting) {
    return (
      <button 
        disabled 
        className={`subtle-button ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '38px',
          padding: '0 14px',
          fontSize: '11px',
          cursor: 'wait',
          opacity: 0.8,
        }}
      >
        <span className="pulse-dot" /> Connecting...
      </button>
    )
  }

  if (connected && truncatedKey) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <div
          className="subtle-button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '38px',
            padding: '0 12px',
            fontSize: '11px',
            borderColor: '#2d604e',
            background: '#0e1c16',
          }}
        >
          <span 
            style={{ 
              width: 7, 
              height: 7, 
              borderRadius: '50%', 
              background: 'var(--green)', 
              boxShadow: '0 0 8px var(--green)' 
            }} 
          />
          <b style={{ color: 'var(--green)' }}>{truncatedKey}</b>
          {balanceSol !== null && (
            <span style={{ color: '#8fa89e', fontSize: '10px' }}>
              ({balanceSol.toFixed(2)} SOL)
            </span>
          )}
        </div>
        <button
          onClick={disconnect}
          title="Disconnect wallet"
          className="subtle-button"
          style={{
            minHeight: '38px',
            padding: '0 10px',
            color: '#8e98a6',
            cursor: 'pointer',
          }}
          aria-label="Disconnect"
        >
          <LogOut size={13} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={openModal}
      className={`primary-button ${className}`}
      style={{
        minHeight: '38px',
        padding: '0 14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      <Wallet size={14} />
      <span>CONNECT WALLET</span>
    </button>
  )
}
