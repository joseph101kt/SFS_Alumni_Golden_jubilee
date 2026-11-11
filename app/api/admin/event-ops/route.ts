// app/api/admin/event-ops/route.ts
// Event ops summary: totals and exceptions. Every figure comes from the shared ledger, so committee
// verified registrations count as settled and are not reported as balance-due exceptions.

import { NextResponse } from 'next/server';
import { classifyRegistration, EXCEPTION_LABELS, type ExceptionKind } from '@/lib/admin/event-exceptions';
import { ledgerFor, loadRegistrationRows, one, refreshRegistrations } from '@/lib/admin/registration-rows';
import { STATE_LABELS, type RegistrationState } from '@/lib/admin/registration-ledger';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { clampGuestCount } from '@/lib/registration/registration';

type ExceptionOut = {
    id: string;
    event_id: string;
    event_title: string;
    full_name: string;
    email: string;
    registration_code: string | null;
    state: RegistrationState;
    state_label: string;
    billed_paise: number;
    settled_paise: number;
    due_paise: number;
    kinds: ExceptionKind[];
    kind_labels: string[];
};

export async function GET(request: Request) {
    const me = await requireVerifiedAdmin();
    if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const eventId = new URL(request.url).searchParams.get('event_id') || '';
    await refreshRegistrations(eventId);

    const { rows, error } = await loadRegistrationRows(eventId);
    if (error) {
        console.error('event-ops', error);
        return NextResponse.json({ error: 'Could not load event ops' }, { status: 500 });
    }

    const stateCounts: Record<RegistrationState, number> = {
        cancelled: 0,
        confirmed: 0,
        awaiting_verification: 0,
        partial: 0,
        unpaid: 0,
    };
    const totals = {
        registration_count: 0,
        people: 0,
        checked_in_count: 0,
        billed_paise: 0,
        settled_paise: 0,
        due_paise: 0,
    };
    const kindCounts: Record<ExceptionKind, number> = {
        balance_due: 0,
        status_mismatch: 0,
        paid_no_code: 0,
        cancelled_with_money: 0,
        overpay: 0,
    };
    const exceptions: ExceptionOut[] = [];

    for (const r of rows) {
        const ledger = ledgerFor(r);
        const guests = clampGuestCount(Number(r.number_of_guests) || 0);
        const attending = r.attending !== false;

        totals.registration_count += 1;
        totals.people += (attending ? 1 : 0) + guests;
        totals.billed_paise += ledger.billedPaise;
        totals.settled_paise += ledger.settledPaise;
        totals.due_paise += ledger.duePaise;
        if (r.checked_in_at) totals.checked_in_count += 1;
        stateCounts[ledger.state] += 1;

        const hit = classifyRegistration({
            id: r.id,
            payment_status: ledger.confirmed ? 'paid' : r.payment_status,
            total_cost_paise: ledger.billedPaise,
            amount_paid_paise: ledger.settledPaise,
            registration_code: r.registration_code,
        });
        if (!hit) continue;

        for (const kind of hit.kinds) kindCounts[kind] += 1;
        const account = one(r.alumni_accounts);
        const event = one(r.event_catalog);
        exceptions.push({
            id: r.id,
            event_id: r.event_id,
            event_title: event?.title || 'Event',
            full_name: account?.full_name || '—',
            email: account?.email || '',
            registration_code: r.registration_code || null,
            state: ledger.state,
            state_label: STATE_LABELS[ledger.state],
            billed_paise: hit.total_cost_paise,
            settled_paise: hit.amount_paid_paise,
            due_paise: hit.amount_due_paise,
            kinds: hit.kinds,
            kind_labels: hit.kinds.map((k) => EXCEPTION_LABELS[k]),
        });
    }

    return NextResponse.json({
        totals,
        state_counts: stateCounts,
        state_labels: STATE_LABELS,
        kind_counts: kindCounts,
        exception_labels: EXCEPTION_LABELS,
        exceptions,
    });
}