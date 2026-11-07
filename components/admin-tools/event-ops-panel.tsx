'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCostForDisplay } from '@/lib/registration/registration';
import type { EventCatalog } from '@/lib/events/types';

type Totals = {
  registration_count: number;
  people: number;
  paid_count: number;
  partial_count: number;
  pending_count: number;
  cancelled_count: number;
  checked_in_count: number;
  total_cost_paise: number;
  amount_paid_paise: number;
  amount_due_paise: number;
};

type ExceptionRow = {
  id: string;
  event_id: string;
  event_title: string;
  full_name: string;
  email: string;
  registration_code: string | null;
  payment_status: string;
  total_cost_paise: number;
  amount_paid_paise: number;
  amount_due_paise: number;
  kinds: string[];
  kind_labels: string[];
};

type Payload = {
  totals: Totals;
  kind_counts: Record<string, number>;
  exception_labels: Record<string, string>;
  exceptions: ExceptionRow[];
};

export default function EventOpsPanel() {
  const [events, setEvents] = useState<EventCatalog[]>([]);
  const [eventId, setEventId] = useState('');
  const [kind, setKind] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const params = new URLSearchParams();
    if (eventId) params.set('event_id', eventId);
    const res = await fetch(`/api/admin/event-ops?${params}`, { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || 'Could not load event ops');
      setData(null);
      return;
    }
    setData(payload as Payload);
  }, [eventId]);

  useEffect(() => {
    fetch('/api/admin/events')
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) setEvents(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!kind) return data.exceptions;
    return data.exceptions.filter((e) => e.kinds.includes(kind));
  }, [data, kind]);

  const t = data?.totals;

  const kpis = t
    ? [
        { label: 'Registrations', value: String(t.registration_count) },
        { label: 'People', value: String(t.people) },
        { label: 'Checked in', value: String(t.checked_in_count) },
        { label: 'Paid', value: String(t.paid_count) },
        { label: 'Partial', value: String(t.partial_count) },
        { label: 'Pending', value: String(t.pending_count) },
        { label: 'Total billed', value: formatCostForDisplay(t.total_cost_paise) },
        { label: 'Money received', value: formatCostForDisplay(t.amount_paid_paise) },
        { label: 'Still due', value: formatCostForDisplay(t.amount_due_paise) },
      ]
    : [];

  return (
    <>
      {error && (
        <p className="rounded-xl border border-error/30 bg-error-container p-4 text-body-sm text-error mb-4">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          className="px-4 py-3.5 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <Link
          href={`/admin/registrations${eventId ? `?event=${eventId}` : ''}`}
          className="inline-flex items-center justify-center rounded-lg border border-primary/20 px-4 py-2.5 text-label-sm text-primary hover:bg-secondary-container/40"
        >
          Open registrations
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3 mb-8">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-primary/10 bg-surface-paper p-4 shadow-sm"
          >
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">{k.label}</p>
            <p className="mt-2 text-headline-sm text-primary tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-headline-sm text-primary">Exceptions</h2>
        <select
          className="px-4 py-3 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">All kinds ({data?.exceptions.length ?? 0})</option>
          {data &&
            Object.entries(data.exception_labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label} ({data.kind_counts[key] || 0})
              </option>
            ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-surface-paper shadow-sm">
        <table className="min-w-full text-left text-body-sm">
          <thead className="bg-primary text-label-sm text-secondary-container">
            <tr>
              <th className="px-4 py-3">Alumnus</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Paid / Due</th>
              <th className="px-4 py-3">Issues</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-on-surface-variant">
                  No exceptions in this view.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-jubilee-gold-light/60 odd:bg-surface-ivory/70">
                  <td className="px-4 py-3">
                    <div className="font-medium text-primary">{row.full_name}</div>
                    <div className="text-label-sm text-on-surface-variant">{row.email}</div>
                  </td>
                  <td className="px-4 py-3 text-navy-subtle">{row.event_title}</td>
                  <td className="px-4 py-3 tracking-wide">{row.registration_code || '—'}</td>
                  <td className="px-4 py-3 capitalize">{row.payment_status}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatCostForDisplay(row.amount_paid_paise)} / {formatCostForDisplay(row.amount_due_paise)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.kind_labels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex rounded-md bg-jubilee-gold-light/70 px-2 py-0.5 text-label-sm text-on-secondary-fixed-variant"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
