'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import PwaInstall from '@/components/pwa-install';

const baseLinks: { href: string; label: string; emphasize?: boolean }[] = [
  { href: '/member', label: 'Home' },
  { href: '/member/donate', label: 'Donate', emphasize: true },
  { href: '/directory', label: 'People' },
  { href: '/events', label: 'Events' },
  { href: '/stories', label: 'Stories' },
  { href: '/memories', label: 'Memories' },
  { href: '/submissions', label: 'My submissions' },
];

function linkActive(path: string, href: string) {
  if (href === '/admin') return path === '/admin' || path.startsWith('/admin/');
  if (href === '/member/donate') return path === href || path.startsWith('/member/donate');
  if (href === '/member') return path === '/member';
  return path === href;
}

function GetAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-primary/50 backdrop-blur-[2px] cursor-pointer"
        aria-label="Close get the app dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[81] w-full sm:max-w-lg max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-surface-paper border border-outline-variant shadow-xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-outline-variant">
          <div>
            <p className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
              Event app
            </p>
            <h2 id={titleId} className="text-headline-sm text-primary mt-1">
              Get the app
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-primary hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          <PwaInstall shareMode />
        </div>
      </div>
    </div>
  );
}

export default function PortalShell({
  children,
  title,
  eyebrow = 'SFS ALUMNI COMMUNITY',
  intro,
  sidebar = true,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  intro?: string;
  sidebar?: boolean;
}) {
  const path = usePathname() || '';
  const [isAdmin, setIsAdmin] = useState(false);
  const [getAppOpen, setGetAppOpen] = useState(false);

  useEffect(() => {
    if (!sidebar) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!active || !res.ok) return;
        const me = await res.json();
        if (active) setIsAdmin(me.role === 'admin' && me.member_status === 'verified');
      } catch {
        if (active) setIsAdmin(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sidebar]);

  const links = isAdmin
    ? [...baseLinks, { href: '/admin', label: 'Admin' }]
    : baseLinks;

  return (
    <main className="min-h-screen bg-surface pt-24 pb-16 print:pt-0 print:pb-0 print:bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 print:max-w-none print:px-0">
        <div className="flex gap-4 sm:gap-6 lg:gap-10 items-start">
          {sidebar ? (
            <aside className="print:hidden w-32 sm:w-48 lg:w-56 shrink-0 sticky top-28 self-start rounded-2xl border border-outline-variant bg-surface-paper p-3 sm:p-4">
              <p className="text-sm sm:text-base font-extrabold text-primary tracking-tight px-1.5 sm:px-1 leading-tight">
                SFS Alumni
              </p>
              <p className="text-[11px] sm:text-[12px] uppercase tracking-[0.12em] text-jubilee-gold-deep font-bold px-1.5 sm:px-1 mb-2 sm:mb-3">
                Golden Jubilee
              </p>
              <nav aria-label="Alumni portal" className="flex flex-col gap-1">
                {links.map(({ href, label, emphasize }) => {
                  const active = linkActive(path, href);
                  if (emphasize && !active) {
                    return (
                      <Link
                        key={href}
                        href={href}
                        className="donate-flash-nav rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-3 text-[14px] sm:text-base leading-snug border border-transparent cursor-pointer"
                      >
                        {label}
                      </Link>
                    );
                  }
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-3 text-[14px] sm:text-base font-medium leading-snug transition-colors cursor-pointer ${
                        active
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setGetAppOpen(true)}
                  className="mt-1 rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-3 text-left text-[14px] sm:text-base font-medium leading-snug text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  Get the app
                </button>
              </nav>
            </aside>
          ) : null}

          <div className="min-w-0 flex-1 print:w-full">
            <div className="print:hidden mb-5 lg:mb-6">
              <div className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold mb-2">
                {eyebrow}
              </div>
              <h1 className="text-headline-lg text-primary leading-tight">{title}</h1>
              {intro ? (
                <p className="text-body-md text-on-surface-variant mt-2 max-w-3xl">{intro}</p>
              ) : null}
            </div>

            {children}
          </div>
        </div>
      </div>
      {sidebar ? <GetAppDialog open={getAppOpen} onClose={() => setGetAppOpen(false)} /> : null}
    </main>
  );
}
