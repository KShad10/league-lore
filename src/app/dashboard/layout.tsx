'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard/stats', label: 'Stats' },
  { href: '/dashboard/managers', label: 'Managers' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/sync', label: 'Sync', deemphasized: true },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top Navigation Bar */}
      <nav
        style={{
          background: 'var(--accent-primary)',
          padding: 'var(--space-sm) var(--space-xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '3px solid var(--accent-secondary)',
        }}
      >
        <Link
          href="/"
          style={{
            color: 'var(--background)',
            textDecoration: 'none',
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: '1.25rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          League Lore
        </Link>

        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  color: isActive ? 'var(--accent-gold)' : 'var(--background)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                  fontSize: item.deemphasized ? '0.8125rem' : '0.875rem',
                  fontWeight: isActive ? 700 : 500,
                  padding: 'var(--space-sm) var(--space-md)',
                  opacity: item.deemphasized && !isActive ? 0.7 : 1,
                  transition: 'color 0.15s ease, opacity 0.15s ease',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
