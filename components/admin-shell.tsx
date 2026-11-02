'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import GetAppDialog from '@/components/get-app-dialog';

const LINKS: { href: string; label: string; icon: string; match?: 'exact' | 'prefix' }[] = [
  { href: '/admin', label: 'Overview', icon: 'dashboard', match: 'exact' },
  { href: '/admin/event-ops', label: 'Event ops', icon: 'analytics', match: 'prefix' },
  { href: '/admin/approvals', label: 'Approvals', icon: 'fact_check', match: 'prefix' },
  { href: '/admin/check-in', label: 'Check-in', icon: 'qr_code_scanner', match: 'prefix' },
  { href: '/admin/broadcast', label: 'Broadcast', icon: 'campaign', match: 'prefix' },
  { href: '/admin/membership', label: 'Membership', icon: 'group', match: 'prefix' },
  { href: '/admin/events', label: 'Events', icon: 'event', match: 'prefix' },
  { href: '/admin/registrations', label: 'Registrations', icon: 'confirmation_number', match: 'prefix' },
  { href: '/admin/memories', label: 'Memories', icon: 'photo_library', match: 'prefix' },
  { href: '/admin/stories', label: 'Stories', icon: 'menu_book', match: 'prefix' },
  { href: '/admin/committee', label: 'Committee', icon: 'groups', match: 'prefix' },
  { href: '/admin/donations', label: 'Donate setup', icon: 'volunteer_activism', match: 'prefix' },
  { href: '/admin/import', label: 'Import', icon: 'upload_file', match: 'prefix' },
];

function isActive(pathname: string, href: string, match: 'exact' | 'prefix' = 'prefix') {
  if (match === 'exact') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [getAppOpen, setGetAppOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      <nav
        aria-label="Admin sections"
        className="print:hidden lg:w-56 shrink-0 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 lg:pr-5 lg:border-r border-outline-variant"
      >
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href, link.match);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-label-sm transition-colors cursor-pointer ${
                active
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-navy-subtle hover:bg-secondary-container/40 hover:text-primary'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  active ? 'text-secondary-container' : 'text-jubilee-gold-deep'
                }`}
              >
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setGetAppOpen(true)}
          className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-label-sm text-navy-subtle hover:bg-secondary-container/40 hover:text-primary transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <span className="material-symbols-outlined text-[18px] text-jubilee-gold-deep">
            install_mobile
          </span>
          Get the app
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-2 lg:mt-4 inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-label-sm text-error hover:bg-error-container/40 transition-colors cursor-pointer border border-error/20"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Logout
        </button>
      </nav>
      <div className="min-w-0 flex-1">
        <div className="print:hidden mb-6 border-b border-outline-variant pb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-label-sm uppercase tracking-[0.16em] text-jubilee-gold-deep font-bold mb-1">
              Committee tools
            </p>
            <h2 className="text-headline-md text-primary">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-label-sm uppercase tracking-wider text-error border border-error/30 hover:bg-error-container transition-colors cursor-pointer lg:hidden"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Logout
          </button>
        </div>
        {children}
      </div>
      <GetAppDialog
        open={getAppOpen}
        onClose={() => setGetAppOpen(false)}
        startPath="/admin-app"
        appLabel="SFS Ops"
        eyebrow="SFS Ops"
        title="Get the ops app"
      />
    </div>
  );
}
