'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const TABS = [
  { href: '/contacts', label: 'Contacts', icon: '👤' },
  { href: '/voice', label: 'Voice', icon: '🎙️' },
  { href: '/holiday', label: 'Holiday', icon: '🎁' },
  { href: '/tags', label: 'Tags', icon: '🏷️' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={clsx(
                  'flex flex-col items-center justify-center py-2 text-xs font-medium',
                  active ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900',
                )}
                style={{ minHeight: 56 }}
              >
                <span aria-hidden className="text-lg">
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
