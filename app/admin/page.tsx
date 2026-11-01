'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin-shell';

type Overview = {
  pendingMembers: number;
  publishedEvents: number;
  unpaidRegistrations: number;
  pendingMemories?: number;
  pendingStories?: number;
  pendingApprovals?: number;
  amountPaidPaise?: number;
  amountDuePaise?: number;
  registrationCount?: number;
  catalogReady?: boolean;
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/overview');
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(payload.error || 'Could not load overview');
          return;
        }
        setData(payload as Overview);
      } catch {
        setError('Could not load overview');
      }
    })();
  }, []);

  const moneyPaid =
    data?.amountPaidPaise != null
      ? `₹${(data.amountPaidPaise / 100).toLocaleString('en-IN')}`
      : '—';
  const moneyDue =
    data?.amountDuePaise != null
      ? `₹${(data.amountDuePaise / 100).toLocaleString('en-IN')}`
      : '—';

  const cards = [
    {
      href: '/admin/approvals',
      label: 'Pending approvals',
      value: data?.pendingApprovals ?? '—',
      hint: 'Memberships, memories, and stories',
      icon: 'fact_check',
      tone: 'gold' as const,
    },
    {
      href: '/admin/event-ops',
      label: 'Registrations',
      value: data?.registrationCount ?? '—',
      hint: 'Money, exceptions, check-ins',
      icon: 'analytics',
      tone: 'navy' as const,
    },
    {
      href: '/admin/event-ops',
      label: 'Money received',
      value: moneyPaid,
      hint: `Still due ${moneyDue}`,
      icon: 'payments',
      tone: 'amber' as const,
    },
    {
      href: '/admin/registrations',
      label: 'Unpaid / partial',
      value: data?.unpaidRegistrations ?? '—',
      hint: 'Review and mark paid',
      icon: 'confirmation_number',
      tone: 'amber' as const,
    },
    {
      href: '/admin/events',
      label: 'Published events',
      value: data?.publishedEvents ?? '—',
      hint: data?.catalogReady === false ? 'Apply event_catalog migration' : 'Create and price events',
      icon: 'event',
      tone: 'navy' as const,
    },
    {
      href: '/admin/membership',
      label: 'Pending memberships',
      value: data?.pendingMembers ?? '—',
      hint: 'Approve or reject applicants',
      icon: 'group',
      tone: 'gold' as const,
    },
  ];

  const toneClass = {
    gold: {
      card: 'border-jubilee-gold-light bg-gradient-to-br from-secondary-container/35 to-surface-paper',
      iconWrap: 'bg-secondary-container text-on-secondary-container',
    },
    navy: {
      card: 'border-primary/15 bg-gradient-to-br from-primary-fixed/50 to-surface-paper',
      iconWrap: 'bg-primary text-secondary-container',
    },
    amber: {
      card: 'border-jubilee-amber/25 bg-gradient-to-br from-jubilee-gold-light/50 to-surface-paper',
      iconWrap: 'bg-jubilee-gold-deep text-on-primary',
    },
  };

  return (
    <AdminShell title="Overview">
      {error && (
        <p className="rounded-xl border border-error-container bg-error-container/40 p-4 text-body-sm text-on-error-container mb-4">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const t = toneClass[c.tone];
          return (
            <Link
              key={c.href}
              href={c.href}
              className={`rounded-2xl border p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${t.card}`}
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${t.iconWrap}`}
              >
                <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
              </span>
              <div className="text-display-sm text-primary mt-4 tabular-nums">{c.value}</div>
              <div className="text-label-md text-primary font-bold mt-1">{c.label}</div>
              <p className="text-body-sm text-on-surface-variant mt-1">{c.hint}</p>
            </Link>
          );
        })}
      </div>
    </AdminShell>
  );
}
