'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

export default function AdminOpsShell({
  title,
  children,
  homeHref = '/admin-app',
}: {
  title: string;
  children: ReactNode;
  homeHref?: string;
}) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const showBack = pathname !== homeHref && !pathname.startsWith(`${homeHref}?`);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login?next=%2Fadmin-app');
    router.refresh();
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface">
      <header className="sticky top-0 z-10 border-b border-outline-variant bg-surface-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          {showBack ? (
            <Link
              href={homeHref}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              aria-label="Back to ops home"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </Link>
          ) : (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-jubilee-gold-deep">
              <span className="material-symbols-outlined text-[22px]">shield_person</span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-jubilee-gold-deep font-bold">
              SFS Ops
            </p>
            <h1 className="truncate text-headline-sm text-primary leading-tight">{title}</h1>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-label-sm text-error border border-error/20 hover:bg-error-container/40 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Logout
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-5 pb-10">{children}</div>
    </div>
  );
}
