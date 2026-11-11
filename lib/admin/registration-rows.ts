// lib/admin/registration-rows.ts
// Loads event registrations for the admin screens and works out each row's ledger.
// Both admin routes read through here, so the list, event ops totals and exceptions always agree.

import { computeLedger, type DonationRow, type RegistrationLedger } from '@/lib/admin/registration-ledger';
import { issueMissingPaidCodes, type RegistrationCodeAdmin } from '@/lib/events/registration-code';
import { repriceEventRegistrations } from '@/lib/events/reprice';
import { createAdminClient } from '@/lib/supabase-admin';

export const REGISTRATION_SELECT = [
    'id',
    'event_id',
    'account_id',
    'phone_number',
    'number_of_guests',
    'guests_eating',
    'guests_checked_in',
    'attending',
    'lunch',
    'food_preference',
    'total_cost_paise',
    'amount_paid_paise',
    'payment_status',
    'registration_code',
    'core_committee_manually_verified',
    'checked_in_at',
    'bank_reference',
    'created_at',
    'donation:donations!event_registrations_donation_id_fkey(amount_paise,payment_status)',
    'event_catalog(title)',
    'alumni_accounts(full_name,email,batch)',
].join(',');

type AccountEmbed = { full_name: string; email: string; batch?: number | null };

export interface RegistrationDbRow {
    id: string;
    event_id: string;
    account_id: string;
    phone_number: string | null;
    number_of_guests: number | null;
    guests_eating: number | null;
    guests_checked_in: number | null;
    attending: boolean;
    lunch: boolean;
    food_preference: string | null;
    total_cost_paise: number;
    amount_paid_paise: number;
    payment_status: string;
    registration_code: string | null;
    core_committee_manually_verified: boolean | null;
    checked_in_at: string | null;
    bank_reference: string | null;
    created_at: string;
    donation: DonationRow | DonationRow[] | null;
    event_catalog: { title: string } | { title: string }[] | null;
    alumni_accounts: AccountEmbed | AccountEmbed[] | null;
}

export function one<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] || null : value;
}

/** Reprices registrations and issues any missing codes, so the figures read next are current. */
export async function refreshRegistrations(eventId: string): Promise<void> {
    const admin = createAdminClient();
    if (eventId) {
        await repriceEventRegistrations(eventId);
    } else {
        const { data: catalog } = await admin.from('event_catalog').select('id');
        for (const row of catalog || []) {
            await repriceEventRegistrations(String((row as { id: string }).id));
        }
    }
    await issueMissingPaidCodes(admin as unknown as RegistrationCodeAdmin);
}

export async function loadRegistrationRows(
    eventId: string
): Promise<{ rows: RegistrationDbRow[]; error: string | null }> {
    const admin = createAdminClient();
    let query = admin
        .from('event_registrations')
        .select(REGISTRATION_SELECT)
        .order('created_at', { ascending: false });
    if (eventId) query = query.eq('event_id', eventId);

    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: (data || []) as unknown as RegistrationDbRow[], error: null };
}

export function ledgerFor(row: RegistrationDbRow): RegistrationLedger {
    return computeLedger({
        payment_status: row.payment_status,
        total_cost_paise: row.total_cost_paise,
        amount_paid_paise: row.amount_paid_paise,
        core_committee_manually_verified: row.core_committee_manually_verified,
        bank_reference: row.bank_reference,
        donation: one(row.donation),
    });
}