// lib/admin/registration-ledger.ts
// Money and status for one event registration, worked out from its database row.
// The admin registrations list, event ops totals and exception checks all use this, so they agree.
//
// Rules:
// - A failed donation is not billed. A paid donation counts as received.
// - The committee can verify a registration by hand (used for bank transfers). Verification settles
//   the balance even when no payment was recorded online.
// - A registration is confirmed when it is not cancelled and either the committee verified it, or it
//   is paid with nothing left due (or it costs nothing).
// - "Awaiting verification" means money is still due and a bank reference was entered, so the
//   committee has something to check against the bank statement.

export type DonationRow = { amount_paise: number; payment_status: string };

export type RegistrationState = 'cancelled' | 'confirmed' | 'awaiting_verification' | 'partial' | 'unpaid';

export const STATE_LABELS: Record<RegistrationState, string> = {
    cancelled: 'Cancelled',
    confirmed: 'Confirmed',
    awaiting_verification: 'Awaiting verification',
    partial: 'Partly paid',
    unpaid: 'Unpaid',
};

export interface LedgerInput {
    payment_status: string;
    total_cost_paise: number;
    amount_paid_paise: number;
    core_committee_manually_verified: boolean | null;
    bank_reference: string | null;
    donation: DonationRow | null;
}

export interface RegistrationLedger {
    /** Fee plus billable donation. A failed donation is left out. */
    billedPaise: number;
    /** Money counted as received: recorded payments, or the whole bill when verified. */
    settledPaise: number;
    /** Money still owed. Zero once the registration is confirmed. */
    duePaise: number;
    committeeVerified: boolean;
    confirmed: boolean;
    state: RegistrationState;
}

function nonNegative(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function computeLedger(input: LedgerInput): RegistrationLedger {
    const feeBilled = nonNegative(input.total_cost_paise);
    const feeRecorded = nonNegative(input.amount_paid_paise);
    const feeDue = Math.max(0, feeBilled - feeRecorded);

    const donationStatus = input.donation?.payment_status ?? null;
    const donationAmount = nonNegative(input.donation?.amount_paise);
    const donationBilled = donationStatus && donationStatus !== 'failed' ? donationAmount : 0;
    const donationDue = donationBilled > 0 && donationStatus !== 'paid' ? donationAmount : 0;

    const billed = feeBilled + donationBilled;
    const onlineDue = feeDue + donationDue;
    const cancelled = input.payment_status === 'cancelled';
    const committeeVerified = input.core_committee_manually_verified === true;
    const paidOnline = input.payment_status === 'paid' && onlineDue === 0;
    const confirmed = !cancelled && (committeeVerified || paidOnline || billed === 0);

    const duePaise = confirmed ? 0 : onlineDue;
    const settledPaise = billed - duePaise;
    const hasBankReference = Boolean(input.bank_reference?.trim());

    const state: RegistrationState = cancelled
        ? 'cancelled'
        : confirmed
          ? 'confirmed'
          : duePaise > 0 && hasBankReference
            ? 'awaiting_verification'
            : settledPaise > 0
              ? 'partial'
              : 'unpaid';

    return { billedPaise: billed, settledPaise, duePaise, committeeVerified, confirmed, state };
}