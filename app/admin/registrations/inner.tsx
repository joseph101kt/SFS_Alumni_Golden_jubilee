'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/admin-shell';
import {
  formatCostForDisplay,
  formatGuestMealCounts,
  guestMealCounts,
  guestsFromLegacy,
  normalizeGuests,
  type GuestChoice,
} from '@/lib/registration';
import { groupByBatchSorted } from '@/lib/admin/reg-print-groups';
import type { EventCatalog } from '@/lib/events/types';

type Row = {
  id: string;
  event_id: string;
  event_title: string;
  full_name: string;
  email: string;
  batch: number | null;
  number_of_guests: number;
  lunch: boolean;
  dinner: boolean;
  food_preference?: string | null;
  guests?: GuestChoice[] | null;
  parking_needed: string;
  total_cost_paise: number;
  amount_paid_paise?: number;
  amount_due_paise?: number;
  payment_status: string;
  registration_code?: string | null;
  created_at: string;
};

function mealLine(r: Row): string {
  const guests =
    Array.isArray(r.guests) && r.guests.length > 0
      ? normalizeGuests(r.guests, r.number_of_guests)
      : guestsFromLegacy(r.number_of_guests, r.food_preference, r.lunch, r.dinner);
  return formatGuestMealCounts(guestMealCounts(guests));
}

export default function AdminRegistrationsInner() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventCatalog[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [eventId, setEventId] = useState(searchParams.get('event') || '');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (eventId) params.set('event_id', eventId);
    if (status) params.set('payment_status', status);
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/admin/registrations?${params}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(payload.error || 'Could not load registrations');
      setRows([]);
      return;
    }
    setMessage('');
    setRows(payload as Row[]);
  }, [eventId, status, q]);

  useEffect(() => {
    fetch('/api/admin/events')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function setPayment(id: string, payment_status: 'paid' | 'pending') {
    setBusy(id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment_status }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Update failed');
        return;
      }
      setMessage(`Marked ${payment_status}.`);
      await load();
    } finally {
      setBusy('');
    }
  }

  const batchGroups = useMemo(() => groupByBatchSorted(rows), [rows]);
  const eventTitle =
    events.find((e) => e.id === eventId)?.title ||
    (eventId ? 'Selected event' : 'All events');
  const printedAt = useMemo(() => new Date().toLocaleString('en-IN'), [rows]);

  return (
    <AdminShell title="Registrations">
      <div className="print:hidden">
        {message && (
          <p className="rounded-xl border border-jubilee-gold-light bg-secondary-container/30 p-4 text-body-sm text-on-secondary-fixed-variant mb-4">
            {message}
          </p>
        )}
        <div className="flex flex-col md:flex-row gap-3 mb-5">
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
          <select
            className="px-4 py-3.5 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, or registration ID…"
            className="flex-1 px-4 py-3.5 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory focus:outline-none focus:border-jubilee-gold-deep"
          />
          <button
            type="button"
            onClick={() => window.print()}
            disabled={rows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-on-primary px-4 py-2.5 text-label-sm font-bold disabled:opacity-40 cursor-pointer hover:bg-primary-container shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print roster
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-surface-paper shadow-sm">
          <table className="min-w-full text-left text-body-sm">
            <thead className="bg-primary text-label-sm text-secondary-container">
              <tr>
                <th className="px-4 py-3 font-medium">Registration ID</th>
                <th className="px-4 py-3 font-medium">Alumnus</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Guests</th>
                <th className="px-4 py-3 font-medium">Meals</th>
                <th className="px-4 py-3 font-medium">Parking</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-on-surface-variant bg-surface-ivory">
                    No registrations match.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const paid = r.amount_paid_paise || 0;
                  const due = r.amount_due_paise ?? Math.max(0, r.total_cost_paise - paid);
                  return (
                    <tr key={r.id} className="border-t border-jubilee-gold-light/60 odd:bg-surface-ivory/70">
                      <td className="px-4 py-3 font-medium tracking-wide text-primary">
                        {r.registration_code || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-primary">{r.full_name}</div>
                        <div className="text-label-sm text-on-surface-variant">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{r.batch ?? '—'}</td>
                      <td className="px-4 py-3 text-navy-subtle">{r.event_title}</td>
                      <td className="px-4 py-3">{r.number_of_guests}</td>
                      <td className="px-4 py-3 text-body-sm">{mealLine(r)}</td>
                      <td className="px-4 py-3">{r.parking_needed}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-primary">
                        {formatCostForDisplay(r.total_cost_paise)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-jubilee-gold-deep font-medium">
                        {formatCostForDisplay(paid)}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium text-on-surface">
                        {formatCostForDisplay(due)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-label-sm capitalize ${
                            r.payment_status === 'paid'
                              ? 'bg-primary text-secondary-container'
                              : r.payment_status === 'partial'
                                ? 'bg-jubilee-gold-light text-on-secondary-fixed-variant'
                                : r.payment_status === 'pending'
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {r.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {r.payment_status !== 'paid' && (
                            <button
                              type="button"
                              disabled={busy === r.id}
                              className="rounded-lg bg-secondary-container text-on-secondary-container px-3 py-1.5 text-label-sm disabled:opacity-50 cursor-pointer hover:bg-secondary-fixed"
                              onClick={() => setPayment(r.id, 'paid')}
                            >
                              Mark paid
                            </button>
                          )}
                          {(r.payment_status === 'paid' || r.payment_status === 'partial') && (
                            <button
                              type="button"
                              disabled={busy === r.id}
                              className="rounded-lg border border-primary/20 bg-surface-ivory px-3 py-1.5 text-label-sm text-primary disabled:opacity-50 cursor-pointer"
                              onClick={() => setPayment(r.id, 'pending')}
                            >
                              Mark unpaid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="print-roster hidden">
        <h1>SFS Alumni — Registration roster</h1>
        <p style={{ margin: '0 0 8pt', fontSize: '10pt' }}>
          {eventTitle}
          {status ? ` · Status: ${status}` : ''}
          {q.trim() ? ` · Search: ${q.trim()}` : ''}
          {' · '}
          {rows.length} registration{rows.length === 1 ? '' : 's'}
          {' · Printed '}
          {printedAt}
        </p>
        {batchGroups.map((g) => (
          <div key={g.batchLabel} className="batch-block">
            <h2>
              {g.batchLabel} ({g.rows.length})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reg ID</th>
                  <th>Event</th>
                  <th>Guests</th>
                  <th>Meals</th>
                  <th>Parking</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const paid = r.amount_paid_paise || 0;
                  const due = r.amount_due_paise ?? Math.max(0, r.total_cost_paise - paid);
                  return (
                    <tr key={r.id}>
                      <td>{r.full_name}</td>
                      <td>{r.registration_code || '—'}</td>
                      <td>{r.event_title}</td>
                      <td>{r.number_of_guests}</td>
                      <td>{mealLine(r)}</td>
                      <td>{r.parking_needed}</td>
                      <td>{formatCostForDisplay(r.total_cost_paise)}</td>
                      <td>{formatCostForDisplay(paid)}</td>
                      <td>{formatCostForDisplay(due)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{r.payment_status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
