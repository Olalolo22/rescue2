'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { PROTOCOL_CONSTANTS } from '@/lib/protocol/constants'

interface SolanaWalletProvider {
  isPhantom?: boolean
  isSolflare?: boolean
  isBackpack?: boolean
  publicKey?: { toBase58(): string; toString(): string }
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>
  disconnect(): Promise<void>
  on?(event: string, callback: (...args: any[]) => void): void
  removeListener?(event: string, callback: (...args: any[]) => void): void
  signTransaction?(tx: any): Promise<any>
  signAllTransactions?(txs: any[]): Promise<any[]>
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider
    phantom?: { solana?: SolanaWalletProvider }
    solflare?: SolanaWalletProvider
    backpack?: SolanaWalletProvider
  }
}

interface WalletContextType {
  publicKey: string | null
  connected: boolean
  connecting: boolean
  walletName: string | null
  balanceSol: number | null
  isModalOpen: boolean
  connect: (type?: 'phantom' | 'solflare' | 'backpack') => Promise<void>
  disconnect: () => Promise<void>
  openModal: () => void
  closeModal: () => void
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  connected: false,
  connecting: false,
  walletName: null,
  balanceSol: null,
  isModalOpen: false,
  connect: async () => {},
  disconnect: async () => {},
  openModal: () => {},
  closeModal: () => {},
  refreshBalance: async () => {},
})

export function useSolanaWallet() {
  return useContext(WalletContext)
}

export function SolanaWalletProviderComponent({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [walletName, setWalletName] = useState<string | null>(null)
  const [balanceSol, setBalanceSol] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Resolve provider from window
  const getProvider = useCallback((type?: 'phantom' | 'solflare' | 'backpack'): SolanaWalletProvider | null => {
    if (typeof window === 'undefined') return null

    if (type === 'solflare' && window.solflare) return window.solflare
    if (type === 'backpack' && window.backpack) return window.backpack
    if (type === 'phantom') {
      if (window.phantom?.solana?.isPhantom) return window.phantom.solana
      if (window.solana?.isPhantom) return window.solana
    }

    // Default auto-detection
    if (window.phantom?.solana) return window.phantom.solana
    if (window.solana) return window.solana
    if (window.solflare) return window.solflare
    if (window.backpack) return window.backpack

    return null
  }, [])

  // Fetch Devnet balance for connected wallet
  const fetchBalance = useCallback(async (pubkey: string) => {
    try {
      const res = await fetch(PROTOCOL_CONSTANTS.RPC_SOLANA_DEVNET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [pubkey, { commitment: 'confirmed' }],
        }),
      })
      const data = await res.json()
      if (data.result?.value !== undefined) {
        setBalanceSol(data.result.value / 1_000_000_000)
      }
    } catch (err) {
      console.warn('[Rescue Wallet] Could not fetch devnet balance:', err)
    }
  }, [])

  const connect = useCallback(async (type?: 'phantom' | 'solflare' | 'backpack') => {
    const provider = getProvider(type)
    if (!provider) {
      setIsModalOpen(true)
      return
    }

    try {
      setConnecting(true)
      const res = await provider.connect()
      const key = res.publicKey.toBase58()
      setPublicKey(key)
      setWalletName(
        provider.isPhantom ? 'Phantom' : provider.isSolflare ? 'Solflare' : provider.isBackpack ? 'Backpack' : 'Solana Wallet'
      )
      setIsModalOpen(false)
      await fetchBalance(key)
    } catch (err: any) {
      console.error('[Rescue Wallet] Connect error:', err)
    } finally {
      setConnecting(false)
    }
  }, [getProvider, fetchBalance])

  const disconnect = useCallback(async () => {
    const provider = getProvider()
    try {
      if (provider) await provider.disconnect()
    } catch (err) {
      console.warn('[Rescue Wallet] Disconnect error:', err)
    } finally {
      setPublicKey(null)
      setWalletName(null)
      setBalanceSol(null)
    }
  }, [getProvider])

  // Eager connect if already authorized
  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    provider.connect({ onlyIfTrusted: true })
      .then((res: any) => {
        if (res.publicKey) {
          const key = res.publicKey.toBase58()
          setPublicKey(key)
          setWalletName(provider.isPhantom ? 'Phantom' : 'Solana Wallet')
          fetchBalance(key)
        }
      })
      .catch(() => {
        // Not eagerly connected, normal state
      })

    const handleAccountChange = (newKey: any) => {
      if (newKey) {
        const key = typeof newKey.toBase58 === 'function' ? newKey.toBase58() : String(newKey)
        setPublicKey(key)
        fetchBalance(key)
      } else {
        disconnect()
      }
    }

    provider.on?.('accountChanged', handleAccountChange)
    provider.on?.('disconnect', disconnect)

    return () => {
      provider.removeListener?.('accountChanged', handleAccountChange)
      provider.removeListener?.('disconnect', disconnect)
    }
  }, [getProvider, fetchBalance, disconnect])

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        connected: !!publicKey,
        connecting,
        walletName,
        balanceSol,
        isModalOpen,
        connect,
        disconnect,
        openModal: () => setIsModalOpen(true),
        closeModal: () => setIsModalOpen(false),
        refreshBalance: async () => {
          if (publicKey) await fetchBalance(publicKey)
        },
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}
