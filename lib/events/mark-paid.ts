// lib/events/mark-paid.ts
// The only code that marks a registration or its donation as paid, and the only code that
// issues a registration code after payment. Verify, webhook, admin, and the save path all
// go through here so the rules cannot drift apart.
//
// Rules:
// - A Razorpay payment is applied to the fee first, then to the linked donation.
// - A registration code is issued when the fee and the donation are both settled, or when
//   the committee has verified the registration manually (core_committee_manually_verified).
//   Verification issues the code but does not change payment_status.
// - Applying the same Razorpay payment id twice changes nothing.

import { amountDuePaise, jubileeStatusFromPayment, statusFromAmounts } from '@/lib/events/balance';
import {
  ensureRegistrationCode,
  readRegistrationCode,
  type RegistrationCodeAdmin,
} from '@/lib/events/registration-code';
import { createAdminClient } from '@/lib/supabase-admin';

type AdminClient = ReturnType<typeof createAdminClient>;

const REGISTRATION_COLUMNS =
  'id,event_id,account_id,attending,total_cost_paise,amount_paid_paise,payment_status,donation_id,razorpay_order_id,razorpay_payment_id,core_committee_manually_verified';

const DONATION_COLUMNS = 'id,amount_paise,payment_status';

export type RegistrationSnapshot = {
  id: string;
  event_id: string;
  account_id: string;
  attending: boolean;
  total_cost_paise: number;
  amount_paid_paise: number;
  payment_status: string;
  donation_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  core_committee_manually_verified: boolean | null;
};

export type DonationSnapshot = {
  id: string;
  amount_paise: number;
  payment_status: string;
};

export type SettleSuccess = {
  ok: true;
  payment_status: string;
  amount_paid_paise: number;
  amount_due_paise: number;
  donation_due_paise: number;
  registration_code: string | null;
};

export type SettleFailure = {
  ok: false;
  status: number;
  error: string;
};

export type SettleResult = SettleSuccess | SettleFailure;

export type UnpaidResult =
  | { ok: true; payment_status: 'pending'; amount_paid_paise: 0 }
  | SettleFailure;

export type VerifiedResult =
  | { ok: true; core_committee_manually_verified: boolean; registration_code: string | null }
  | SettleFailure;

/** Donation still owed on the registration's donation row. Failed or paid rows owe nothing. */
export function donationDuePaise(donation: DonationSnapshot | null | undefined): number {
  if (!donation) return 0;
  if (donation.payment_status === 'paid' || donation.payment_status === 'failed') return 0;
  return Math.max(0, Number(donation.amount_paise) || 0);
}

export async function loadRegistration(
  admin: AdminClient,
  registrationId: string
): Promise<RegistrationSnapshot | null> {
  const { data, error } = await admin
    .from('event_registrations')
    .select(REGISTRATION_COLUMNS)
    .eq('id', registrationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as RegistrationSnapshot;
}

export async function loadDonation(
  admin: AdminClient,
  donationId: string | null
): Promise<DonationSnapshot | null> {
  if (!donationId) return null;
  const { data, error } = await admin
    .from('donations')
    .select(DONATION_COLUMNS)
    .eq('id', donationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as DonationSnapshot;
}

/** Issues the registration code when the registration is eligible. Returns the code, or null. */
export async function issueRegistrationCodeIfEligible(
  admin: AdminClient,
  registrationId: string,
  input: { paymentStatus: string; donationDuePaise: number; verified: boolean }
): Promise<string | null> {
  const fullySettled = input.paymentStatus === 'paid' && input.donationDuePaise === 0;
  if (!fullySettled && !input.verified) return null;
  return ensureRegistrationCode(admin as unknown as RegistrationCodeAdmin, registrationId, 'paid');
}

async function syncJubileeStatus(
  admin: AdminClient,
  registration: RegistrationSnapshot,
  paymentStatus: string
): Promise<void> {
  const { data: catalog } = await admin
    .from('event_catalog')
    .select('is_primary')
    .eq('id', registration.event_id)
    .maybeSingle();
  const isPrimary = Boolean((catalog as { is_primary?: boolean } | null)?.is_primary);
  if (!isPrimary) return;
  const { error } = await admin
    .from('alumni_accounts')
    .update({ jubilee_reg_status: jubileeStatusFromPayment(paymentStatus as 'pending' | 'partial' | 'paid') })
    .eq('id', registration.account_id);
  if (error) console.error('mark-paid jubilee status', error);
}

/** Reads the current state without changing anything. Used for repeated payment ids. */
async function currentState(admin: AdminClient, registration: RegistrationSnapshot): Promise<SettleResult> {
  const total = Math.max(0, Number(registration.total_cost_paise) || 0);
  const paid = Math.max(0, Number(registration.amount_paid_paise) || 0);
  const donation = await loadDonation(admin, registration.donation_id);
  const donationDue = donationDuePaise(donation);
  const feeDue = amountDuePaise(total, paid);
  return {
    ok: true,
    payment_status: statusFromAmounts(total, paid),
    amount_paid_paise: paid,
    amount_due_paise: feeDue + donationDue,
    donation_due_paise: donationDue,
    registration_code: await readRegistrationCode(admin as unknown as RegistrationCodeAdmin, registration.id),
  };
}

/**
 * Applies money to the fee first, then to the donation. Writes the Razorpay ids when given.
 * Callers have already checked the payment id and the order id.
 */
async function settle(
  admin: AdminClient,
  registration: RegistrationSnapshot,
  input: {
    paymentPaise: number;
    razorpay?: { orderId: string; paymentId: string; signature: string | null };
  }
): Promise<SettleResult> {
  const total = Math.max(0, Number(registration.total_cost_paise) || 0);
  const paidBefore = Math.max(0, Number(registration.amount_paid_paise) || 0);
  const feeDue = amountDuePaise(total, paidBefore);
  const feePortion = Math.min(input.paymentPaise, feeDue);

  const donation = await loadDonation(admin, registration.donation_id);
  const donationDue = donationDuePaise(donation);
  const remainder = input.paymentPaise - feePortion;
  const donationPortion = Math.min(remainder, donationDue);
  const unapplied = remainder - donationPortion;
  if (unapplied > 0) {
    // Money beyond what is owed. Logged so the committee can reconcile it with Razorpay.
    console.error('mark-paid: payment exceeds amount due', {
      registrationId: registration.id,
      unapplied,
    });
  }

  const amountPaid = paidBefore + feePortion;
  const paymentStatus = statusFromAmounts(total, amountPaid);
  const now = new Date().toISOString();

  const registrationPatch: Record<string, unknown> = {
    amount_paid_paise: amountPaid,
    payment_status: paymentStatus,
    updated_at: now,
  };
  if (input.razorpay) {
    registrationPatch.razorpay_order_id = input.razorpay.orderId;
    registrationPatch.razorpay_payment_id = input.razorpay.paymentId;
    registrationPatch.razorpay_signature = input.razorpay.signature;
  }

  const { error: registrationError } = await admin
    .from('event_registrations')
    .update(registrationPatch)
    .eq('id', registration.id);
  if (registrationError) {
    console.error('mark-paid registration update', registrationError);
    return { ok: false, status: 500, error: 'Could not record the payment' };
  }

  let donationDueAfter = donationDue;
  if (donation && donationDue > 0 && donationPortion >= donationDue) {
    const donationPatch: Record<string, unknown> = {
      payment_status: 'paid',
      updated_at: now,
    };
    if (input.razorpay) {
      donationPatch.razorpay_order_id = input.razorpay.orderId;
      donationPatch.razorpay_payment_id = input.razorpay.paymentId;
      donationPatch.razorpay_signature = input.razorpay.signature;
    }
    const { error: donationError } = await admin.from('donations').update(donationPatch).eq('id', donation.id);
    if (donationError) {
      // The fee is recorded. The donation stays owed so no code is issued until it is fixed.
      console.error('mark-paid donation update', donationError);
    } else {
      donationDueAfter = 0;
    }
  }

  await syncJubileeStatus(admin, registration, paymentStatus);

  const registrationCode = await issueRegistrationCodeIfEligible(admin, registration.id, {
    paymentStatus,
    donationDuePaise: donationDueAfter,
    verified: Boolean(registration.core_committee_manually_verified),
  });

  return {
    ok: true,
    payment_status: paymentStatus,
    amount_paid_paise: amountPaid,
    amount_due_paise: amountDuePaise(total, amountPaid) + donationDueAfter,
    donation_due_paise: donationDueAfter,
    registration_code: registrationCode,
  };
}

/**
 * Applies a Razorpay payment that the caller has already verified (signature checked, or the
 * webhook has fetched the captured amount from Razorpay). The amount must come from Razorpay,
 * never from the browser. Idempotent on the Razorpay payment id.
 */
export async function applyRazorpayPayment(input: {
  registrationId: string;
  orderId: string;
  paymentId: string;
  signature: string | null;
  amountPaise: number;
}): Promise<SettleResult> {
  const admin = createAdminClient();
  const registration = await loadRegistration(admin, input.registrationId);
  if (!registration) return { ok: false, status: 404, error: 'Registration not found' };

  if (registration.razorpay_payment_id && registration.razorpay_payment_id === input.paymentId) {
    return currentState(admin, registration);
  }
  if (registration.razorpay_order_id && registration.razorpay_order_id !== input.orderId) {
    return { ok: false, status: 400, error: 'Payment does not match the current order' };
  }
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    return { ok: false, status: 400, error: 'Payment amount is invalid' };
  }

  return settle(admin, registration, {
    paymentPaise: input.amountPaise,
    razorpay: { orderId: input.orderId, paymentId: input.paymentId, signature: input.signature },
  });
}

/**
 * Settles everything still due (fee and donation) without a Razorpay payment. Used by the
 * admin toggle and by a registration whose total is ₹0.
 */
export async function applyRegistrationPayment(input: {
  registrationId: string;
  settleFull: true;
}): Promise<SettleResult> {
  const admin = createAdminClient();
  const registration = await loadRegistration(admin, input.registrationId);
  if (!registration) return { ok: false, status: 404, error: 'Registration not found' };

  const total = Math.max(0, Number(registration.total_cost_paise) || 0);
  const feeDue = amountDuePaise(total, registration.amount_paid_paise);
  const donationDue = donationDuePaise(await loadDonation(admin, registration.donation_id));

  return settle(admin, registration, { paymentPaise: feeDue + donationDue });
}

/** Admin: clears payment on the fee and the donation. A ₹0 registration has nothing to clear. */
export async function markRegistrationUnpaid(registrationId: string): Promise<UnpaidResult> {
  const admin = createAdminClient();
  const registration = await loadRegistration(admin, registrationId);
  if (!registration) return { ok: false, status: 404, error: 'Registration not found' };

  const total = Math.max(0, Number(registration.total_cost_paise) || 0);
  if (total === 0) {
    return { ok: false, status: 400, error: 'This registration has no fee to mark unpaid' };
  }

  const now = new Date().toISOString();
  const { error: registrationError } = await admin
    .from('event_registrations')
    .update({
      amount_paid_paise: 0,
      payment_status: 'pending',
      razorpay_payment_id: null,
      razorpay_signature: null,
      updated_at: now,
    })
    .eq('id', registration.id);
  if (registrationError) {
    console.error('mark unpaid registration', registrationError);
    return { ok: false, status: 500, error: 'Could not update registration' };
  }

  const donation = await loadDonation(admin, registration.donation_id);
  if (donation?.payment_status === 'paid') {
    const { error: donationError } = await admin
      .from('donations')
      .update({ payment_status: 'pending', razorpay_payment_id: null, razorpay_signature: null, updated_at: now })
      .eq('id', donation.id);
    if (donationError) console.error('mark unpaid donation', donationError);
  }

  await syncJubileeStatus(admin, registration, 'pending');
  return { ok: true, payment_status: 'pending', amount_paid_paise: 0 };
}

/**
 * Admin: sets or clears the committee's manual verification. Setting it true issues the
 * registration code. Clearing it leaves the code in place, since it may already be printed.
 */
export async function setCommitteeVerified(registrationId: string, verified: boolean): Promise<VerifiedResult> {
  const admin = createAdminClient();
  const registration = await loadRegistration(admin, registrationId);
  if (!registration) return { ok: false, status: 404, error: 'Registration not found' };

  const { error } = await admin
    .from('event_registrations')
    .update({ core_committee_manually_verified: verified, updated_at: new Date().toISOString() })
    .eq('id', registration.id);
  if (error) {
    console.error('mark verified', error);
    return { ok: false, status: 500, error: 'Could not update verification' };
  }

  if (!verified) {
    return {
      ok: true,
      core_committee_manually_verified: false,
      registration_code: await readRegistrationCode(admin as unknown as RegistrationCodeAdmin, registration.id),
    };
  }

  const donation = await loadDonation(admin, registration.donation_id);
  const registrationCode = await issueRegistrationCodeIfEligible(admin, registration.id, {
    paymentStatus: registration.payment_status,
    donationDuePaise: donationDuePaise(donation),
    verified: true,
  });
  return { ok: true, core_committee_manually_verified: true, registration_code: registrationCode };
}