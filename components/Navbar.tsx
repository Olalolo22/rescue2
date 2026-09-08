'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Siren, Radio, FileCheck2, ShieldCheck, Zap } from 'lucide-react'
import { WalletButton } from '@/components/WalletButton'

export function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: '/demo', label: 'LIVE CONSOLE', icon: <Radio size={13} /> },
    { href: '/verify', label: 'INVARIANT CHECKS', icon: <ShieldCheck size={13} /> },
    { href: '/proof/rescue-record-rp-0427', label: 'PROOF INSPECTOR', icon: <FileCheck2 size={13} /> },
    { href: '/activity', label: 'ACTIVITY', icon: null },
  ]

  return (
    <header className="site-nav" style={{ minHeight: '76px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
      <Link href="/" className="brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#fff' }}>
        <span className="brand-mark" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '4px', background: '#1c1729', border: '1px solid #3c3258', color: 'var(--purple)' }}>
          <Siren size={15} />
        </span>
        <span style={{ font: '12px var(--font-data)', letterSpacing: '0.12em' }}>RESCUE <b style={{ color: 'var(--purple)' }}>PROTOCOL</b></span>
      </Link>

      <nav className="nav-links" aria-label="Protocol navigation" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
                font: '10px var(--font-data)',
                letterSpacing: '0.1em',
                color: isActive ? 'var(--cyan)' : '#939daa',
                borderBottom: isActive ? '1px solid var(--cyan)' : '1px solid transparent',
                paddingBottom: '4px',
                transition: 'color 0.2s',
              }}
            >
              {link.icon}
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span className="network-status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', font: '10px var(--font-data)', color: '#8fa89e' }}>
          <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 8px var(--green)' }} /> 
          SOLANA DEVNET
        </span>
        <WalletButton />
      </div>
    </header>
  )
}
