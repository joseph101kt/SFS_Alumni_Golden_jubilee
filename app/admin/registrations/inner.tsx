// app/admin/registrations/inner.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/admin-shell';
import { formatCostForDisplay } from '@/lib/registration/registration';
import { groupByBatchSorted } from '@/lib/admin/reg-print-groups';
import type { EventCatalog } from '@/lib/events/types';

type StateKey = 'cancelled' | 'confirmed' | 'awaiting_verification' | 'partial' | 'unpaid';

type Row = {
    id: string;
    event_id: string;
    event_title: string;
    full_name: string;
    email: string;
    batch: number | null;
    attending: boolean;
    number_of_guests: number;
    meals: string;
    billed_paise: number;
    settled_paise: number;
    due_paise: number;
    state: StateKey;
    state_label: string;
    committee_verified: boolean;
    payment_status: string;
    bank_reference: string | null;
    registration_code: string | null;
};

const STATE_OPTIONS: ReadonlyArray<{ value: StateKey | ''; label: string }> = [
    { value: '', label: 'All states' },
    { value: 'awaiting_verification', label: 'Awaiting verification' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'partial', label: 'Partly paid' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'cancelled', label: 'Cancelled' },
];

const STATE_BADGE: Record<StateKey, string> = {
    cancelled: 'bg-surface-container text-on-surface-variant',
    confirmed: 'bg-primary text-secondary-container',
    awaiting_verification: 'bg-secondary-container text-on-secondary-container',
    partial: 'bg-jubilee-gold-light text-on-secondary-fixed-variant',
    unpaid: 'bg-error-container text-error',
};

const BUTTON_PRIMARY =
    'rounded-lg bg-secondary-container text-on-secondary-container px-3 py-1.5 text-label-sm disabled:opacity-50 cursor-pointer hover:bg-secondary-fixed';
const BUTTON_OUTLINE =
    'rounded-lg border border-primary/20 bg-surface-ivory px-3 py-1.5 text-label-sm text-primary disabled:opacity-50 cursor-pointer';

export default function AdminRegistrationsInner() {
    const searchParams = useSearchParams();
    const [events, setEvents] = useState<EventCatalog[]>([]);
    const [rows, setRows] = useState<Row[]>([]);
    const [eventId, setEventId] = useState(searchParams.get('event') || '');
    const [state, setState] = useState<StateKey | ''>('');
    const [q, setQ] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState('');

    const load = useCallback(async () => {
        const params = new URLSearchParams();
        if (eventId) params.set('event_id', eventId);
        if (state) params.set('state', state);
        if (q.trim()) params.set('q', q.trim());
        const res = await fetch(`/api/admin/registrations?${params}`, { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            setMessage(payload.error || 'Could not load registrations');
            setRows([]);
            return;
        }
        setRows(payload as Row[]);
    }, [eventId, state, q]);

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

    /** One place for committee actions: payment status or committee verification. */
    async function patchRegistration(id: string, body: Record<string, unknown>, successMessage: string) {
        setBusy(id);
        setMessage('');
        try {
            const res = await fetch(`/api/admin/registrations/${id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage(payload.error || 'Update failed');
                return;
            }
            setMessage(successMessage);
            await load();
        } finally {
            setBusy('');
        }
    }

    const batchGroups = useMemo(() => groupByBatchSorted(rows), [rows]);
    const eventTitle =
        events.find((e) => e.id === eventId)?.title || (eventId ? 'Selected event' : 'All events');
    const stateLabel = STATE_OPTIONS.find((o) => o.value === state)?.label ?? '';
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
                        value={state}
                        onChange={(e) => setState(e.target.value as StateKey | '')}
                    >
                        {STATE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search name, email, code, or bank reference…"
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
                                <th className="px-4 py-3 font-medium">Attending</th>
                                <th className="px-4 py-3 font-medium">Guests</th>
                                <th className="px-4 py-3 font-medium">Lunch</th>
                                <th className="px-4 py-3 font-medium">Billed</th>
                                <th className="px-4 py-3 font-medium">Received</th>
                                <th className="px-4 py-3 font-medium">Due</th>
                                <th className="px-4 py-3 font-medium">Bank reference</th>
                                <th className="px-4 py-3 font-medium">State</th>
                                <th className="px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-8 text-on-surface-variant bg-surface-ivory">
                                        No registrations match.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => {
                                    const isBusy = busy === r.id;
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
                                            <td className="px-4 py-3">{r.attending ? 'Yes' : 'No'}</td>
                                            <td className="px-4 py-3">{r.number_of_guests}</td>
                                            <td className="px-4 py-3">{r.meals}</td>
                                            <td className="px-4 py-3 tabular-nums font-medium text-primary">
                                                {formatCostForDisplay(r.billed_paise)}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-jubilee-gold-deep font-medium">
                                                {formatCostForDisplay(r.settled_paise)}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums font-medium text-on-surface">
                                                {formatCostForDisplay(r.due_paise)}
                                            </td>
                                            <td className="px-4 py-3 max-w-[14rem]">
                                                {r.bank_reference ? (
                                                    <span className="block truncate text-body-sm" title={r.bank_reference}>
                                                        {r.bank_reference}
                                                    </span>
                                                ) : (
                                                    <span className="text-on-surface-variant">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-2.5 py-1 rounded-md text-label-sm ${STATE_BADGE[r.state]}`}>
                                                    {r.state_label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {r.billed_paise === 0 && (
                                                        <span className="text-label-sm text-on-surface-variant">No fee</span>
                                                    )}
                                                    {r.billed_paise > 0 && r.state !== 'cancelled' && (
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            className={BUTTON_PRIMARY}
                                                            onClick={() =>
                                                                void patchRegistration(
                                                                    r.id,
                                                                    r.committee_verified
                                                                        ? { core_committee_manually_verified: false }
                                                                        : { core_committee_manually_verified: true },
                                                                    r.committee_verified
                                                                        ? 'Verification removed.'
                                                                        : 'Verified by committee. Code issued.'
                                                                )
                                                            }
                                                        >
                                                            {r.committee_verified ? 'Remove verification' : 'Verify'}
                                                        </button>
                                                    )}
                                                    {r.billed_paise > 0 && r.payment_status !== 'paid' && r.state !== 'cancelled' && (
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            className={BUTTON_OUTLINE}
                                                            onClick={() =>
                                                                void patchRegistration(
                                                                    r.id,
                                                                    { payment_status: 'paid' },
                                                                    'Marked paid.'
                                                                )
                                                            }
                                                        >
                                                            Mark paid
                                                        </button>
                                                    )}
                                                    {r.billed_paise > 0 && (r.payment_status === 'paid' || r.settled_paise > 0) && (
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            className={BUTTON_OUTLINE}
                                                            onClick={() =>
                                                                void patchRegistration(
                                                                    r.id,
                                                                    { payment_status: 'pending' },
                                                                    'Marked unpaid.'
                                                                )
                                                            }
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
                    {state ? ` · State: ${stateLabel}` : ''}
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
                                    <th>Attending</th>
                                    <th>Guests</th>
                                    <th>Lunch</th>
                                    <th>Billed</th>
                                    <th>Received</th>
                                    <th>Due</th>
                                    <th>State</th>
                                </tr>
                            </thead>
                            <tbody>
                                {g.rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.full_name}</td>
                                        <td>{r.registration_code || '—'}</td>
                                        <td>{r.event_title}</td>
                                        <td>{r.attending ? 'Yes' : 'No'}</td>
                                        <td>{r.number_of_guests}</td>
                                        <td>{r.meals}</td>
                                        <td>{formatCostForDisplay(r.billed_paise)}</td>
                                        <td>{formatCostForDisplay(r.settled_paise)}</td>
                                        <td>{formatCostForDisplay(r.due_paise)}</td>
                                        <td>{r.state_label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </AdminShell>
    );
}