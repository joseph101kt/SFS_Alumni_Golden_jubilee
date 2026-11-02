'use client';

import Link from 'next/link';
import AdminOpsShell from '@/components/admin-ops-shell';

const TOOLS: { href: string; label: string; hint: string; icon: string }[] = [
  {
    href: '/admin-app/event-ops',
    label: 'Event ops',
    hint: 'Money, exceptions, check-in counts',
    icon: 'analytics',
  },
  {
    href: '/admin-app/approvals',
    label: 'Approvals',
    hint: 'Memberships, memories, stories',
    icon: 'fact_check',
  },
  {
    href: '/admin-app/broadcast',
    label: 'Broadcast',
    hint: 'Push a message to the event app',
    icon: 'campaign',
  },
];

export default function AdminAppHomePage() {
  return (
    <AdminOpsShell title="Committee ops">
      <p className="text-body-sm text-on-surface-variant mb-4">
        Phone tools for day-of and committee work. Install from desktop Admin → Get the app.
      </p>
      <nav aria-label="Ops tools" className="grid gap-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-surface-paper px-4 py-4 shadow-sm transition-colors hover:border-jubilee-gold-deep/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-secondary-container">
              <span className="material-symbols-outlined text-[22px]">{t.icon}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-label-md text-primary font-bold">{t.label}</span>
              <span className="block text-body-sm text-on-surface-variant mt-0.5">{t.hint}</span>
            </span>
            <span className="material-symbols-outlined text-on-surface-variant ml-auto">chevron_right</span>
          </Link>
        ))}
      </nav>
    </AdminOpsShell>
  );
}
