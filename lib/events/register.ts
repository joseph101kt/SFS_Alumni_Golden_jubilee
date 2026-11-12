// lib/events/register.ts
// Reads and saves one account's registration for one event. The fee comes only from
// getEventCostBreakdown. The donation intent is stored as a pending donation row linked
// from the registration. Payment and code issuance happen in mark-paid.ts.
// Parking: has_parking plus 2-wheeler and 4-wheeler counts. Counts are stored as zero when parking is off,
// and total vehicles may not exceed guests + 1 (the alumnus plus each guest).

import type { AlumniAccount } from '@/lib/auth/request';
import {
  OPEN_PAYMENT_STATUSES,
  amountDuePaise,
  jubileeStatusFromPayment,
  statusFromAmounts,
} from '@/lib/events/balance';
import { selectCatalog } from '@/lib/events/catalog-select';
import type { EventCatalog } from '@/lib/events/types';
import { repriceEventRegistrations } from '@/lib/events/reprice';
import {
  donationDuePaise,
  issueRegistrationCodeIfEligible,
  loadDonation,
  type DonationSnapshot,
} from '@/lib/events/mark-paid';
import { readRegistrationCode, type RegistrationCodeAdmin } from '@/lib/events/registration-code';
import { assertDonationAmountPaise } from '@/lib/donations/validate';
import {
  MAX_GUESTS,
  anyoneEating,
  clampGuestCount,
  clampGuestsEating,
  clampVehicleCount,
  getEventCostBreakdown,
  isEventAttending,
  normalizeFoodPreference,
  vehicleCountsProblem,
} from '@/lib/registration/registration';
import {
  formatLocation,
  isValidBatch,
  isValidSection,
  mergeProfilePack,
  readPackedProfile,
} from '@/lib/registration/registration-fields';
import { normalizePhoneNumber, phoneValidationError, splitE164 } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase-admin';

type AdminClient = ReturnType<typeof createAdminClient>;

const REG_SELECT =
  'id,event_id,number_of_guests,guests_eating,attending,lunch,food_preference,has_parking,two_wheeler_count,four_wheeler_count,phone_number,payment_status,total_cost_paise,amount_paid_paise,donation_id,core_committee_manually_verified,bank_reference';

type RegistrationRow = {
  id: string;
  event_id: string;
  number_of_guests: number;
  guests_eating: number;
  attending: boolean;
  lunch: boolean;
  food_preference: string | null;
  has_parking: boolean;
  two_wheeler_count: number;
  four_wheeler_count: number;
  phone_number: string | null;
  payment_status: string;
  total_cost_paise: number;
  amount_paid_paise: number;
  donation_id: string | null;
  core_committee_manually_verified: boolean | null;
  bank_reference: string | null;
};

type ExistingRow = {
  id: string;
  payment_status: string;
  amount_paid_paise: number;
  donation_id: string | null;
  core_committee_manually_verified: boolean | null;
};

function profilePayload(me: AlumniAccount) {
  return {
    full_name: me.full_name,
    last_name: me.last_name,
    email: me.email,
    phone_number: me.phone_number,
    batch: me.batch,
    section: me.section,
    current_location: me.current_location,
  };
}

/**
 * Brings the donation row in line with the intended amount.
 * - A paid donation cannot be changed here. The committee handles it.
 * - Zero intent marks any unpaid donation as failed, meaning it was dropped before payment.
 * - A positive intent updates the unpaid donation, or creates one.
 */
async function syncDonationIntent(
  admin: AdminClient,
  input: {
    accountId: string;
    eventId: string;
    existingDonationId: string | null;
    intendedPaise: number;
  }
): Promise<{ ok: true; donation: DonationSnapshot | null } | { ok: false; status: number; error: string }> {
  const existing = await loadDonation(admin, input.existingDonationId);
  const now = new Date().toISOString();

  if (existing?.payment_status === 'paid') {
    if (input.intendedPaise === existing.amount_paise) return { ok: true, donation: existing };
    return {
      ok: false,
      status: 409,
      error: 'Your donation is already paid. Contact the committee to change it.',
    };
  }

  if (input.intendedPaise === 0) {
    if (existing) {
      const { error } = await admin
        .from('donations')
        .update({ payment_status: 'failed', updated_at: now })
        .eq('id', existing.id);
      if (error) {
        console.error('donation clear', error);
        return { ok: false, status: 500, error: 'Could not update donation' };
      }
    }
    return { ok: true, donation: null };
  }

  if (existing) {
    const { error } = await admin
      .from('donations')
      .update({ amount_paise: input.intendedPaise, payment_status: 'pending', updated_at: now })
      .eq('id', existing.id);
    if (error) {
      console.error('donation update', error);
      return { ok: false, status: 500, error: 'Could not update donation' };
    }
    return {
      ok: true,
      donation: { id: existing.id, amount_paise: input.intendedPaise, payment_status: 'pending' },
    };
  }

  const { data, error } = await admin
    .from('donations')
    .insert({
      account_id: input.accountId,
      event_id: input.eventId,
      cause_id: null,
      amount_paise: input.intendedPaise,
      payment_status: 'pending',
    })
    .select('id,amount_paise,payment_status')
    .single();
  if (error || !data) {
    console.error('donation insert', error);
    return { ok: false, status: 500, error: 'Could not save donation' };
  }
  return { ok: true, donation: data as unknown as DonationSnapshot };
}

export async function getAccountRegistrationForEvent(
  me: AlumniAccount,
  eventId: string
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const id = String(eventId || '').trim();
  if (!id) return { status: 400, payload: { error: 'eventId is required' } };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_registrations')
    .select(REG_SELECT)
    .eq('event_id', id)
    .eq('account_id', me.id)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES])
    .maybeSingle();

  if (error) {
    console.error('reg get', error);
    return {
      status: 500,
      payload: {
        error: error.message || 'Could not load registration. Apply the event_registrations migration.',
      },
    };
  }

  let registrationRow = data;
  if (data) {
    await repriceEventRegistrations(id);
    const refreshed = await admin
      .from('event_registrations')
      .select(REG_SELECT)
      .eq('event_id', id)
      .eq('account_id', me.id)
      .in('payment_status', [...OPEN_PAYMENT_STATUSES])
      .maybeSingle();
    if (!refreshed.error && refreshed.data) registrationRow = refreshed.data;
  }

  // Start from the session account, then overlay the database row. Packed bio fields fill in
  // section and last name when the columns are not present yet.
  let profile: Record<string, unknown> = profilePayload(me);
  const fullProfile = await admin
    .from('alumni_accounts')
    .select('full_name,last_name,email,phone_number,batch,section,current_location,bio')
    .eq('id', me.id)
    .maybeSingle();
  if (!fullProfile.error && fullProfile.data) {
    const row = fullProfile.data as Record<string, unknown>;
    const packed = readPackedProfile(row.bio);
    profile = {
      ...profile,
      ...row,
      section: row.section || packed?.section || profile.section || null,
      last_name: row.last_name || packed?.lastName || profile.last_name || null,
    };
  } else {
    const minProfile = await admin
      .from('alumni_accounts')
      .select('full_name,email,phone_number,batch,current_location,bio')
      .eq('id', me.id)
      .maybeSingle();
    if (!minProfile.error && minProfile.data) {
      const row = minProfile.data as Record<string, unknown>;
      const packed = readPackedProfile(row.bio);
      profile = {
        ...profile,
        ...row,
        section: packed?.section || profile.section || null,
        last_name: packed?.lastName || profile.last_name || null,
      };
    }
  }

  const reg = registrationRow as RegistrationRow | null;
  if (!reg) return { status: 200, payload: { registration: null, profile } };

  const feeTotal = Math.max(0, Number(reg.total_cost_paise) || 0);
  const feePaid = Math.max(0, Number(reg.amount_paid_paise) || 0);
  const feeDue = amountDuePaise(feeTotal, feePaid);

  const donation = await loadDonation(admin, reg.donation_id);
  const donationDue = donationDuePaise(donation);

  // A committee verification can be set directly in the database. Reading the registration
  // applies the same code rule as every other path, so the code appears without a save.
  const verified = Boolean(reg.core_committee_manually_verified);
  const registrationCode = await issueRegistrationCodeIfEligible(admin, reg.id, {
    paymentStatus: reg.payment_status,
    donationDuePaise: donationDue,
    verified,
  });

  // A verified registration is confirmed by the committee. Its balance no longer blocks the QR,
  // so the screens treat it as settled and show the code.
  const committeeConfirmed = verified && registrationCode !== null;

  return {
    status: 200,
    payload: {
      registration: {
        ...reg,
        fee_due_paise: feeDue,
        intended_donation_paise: donation?.amount_paise ?? 0,
        donation_payment_status: donation?.payment_status ?? null,
        donation_due_paise: donationDue,
        total_due_paise: committeeConfirmed ? 0 : feeDue + donationDue,
        committee_confirmed: committeeConfirmed,
        registration_code: registrationCode,
      },
      profile,
    },
  };
}

export async function registerAccountForEvent(
  me: AlumniAccount,
  body: Record<string, unknown>
): Promise<{ status: number; payload: Record<string, unknown> }> {
  if (me.role === 'admin') {
    return {
      status: 400,
      payload: { error: 'Committee accounts do not register for the event here' },
    };
  }

  const eventId = String(body.eventId || '').trim();
  if (!eventId) return { status: 400, payload: { error: 'eventId is required' } };

  const admin = createAdminClient();
  const { data: event, error: eventError } = await selectCatalog((columns) =>
    admin.from('event_catalog').select(columns).eq('id', eventId).eq('published', true).maybeSingle()
  );

  if (eventError || !event) {
    return { status: 404, payload: { error: 'Event not found or not published' } };
  }

  const catalog = event as unknown as EventCatalog;

  // Attendance: the alumnus attends, or at least one guest is coming. Otherwise nothing is saved.
  const requestedGuests = Number(body.number_of_guests ?? 0);
  if (Number.isFinite(requestedGuests) && requestedGuests > MAX_GUESTS) {
    return { status: 400, payload: { error: `You can register up to ${MAX_GUESTS} guests` } };
  }
  const guestCount = clampGuestCount(requestedGuests);
  const attending = body.attending !== false;
  if (!isEventAttending(attending, guestCount)) {
    return {
      status: 400,
      payload: { error: 'Choose at least one person to attend: you or a guest' },
    };
  }

  // Parking: counts are stored only when parking is needed, and the total cannot exceed
  // the people coming (alumnus + guests).
  const hasParking = body.has_parking === true;
  const twoWheelers = hasParking ? clampVehicleCount(body.two_wheeler_count) : 0;
  const fourWheelers = hasParking ? clampVehicleCount(body.four_wheeler_count) : 0;
  if (hasParking) {
    const parkingProblem = vehicleCountsProblem(twoWheelers, fourWheelers, guestCount);
    if (parkingProblem) return { status: 400, payload: { error: parkingProblem } };
  }

  // Eating: the alumnus eats only when attending. Guests eat by count.
  const alumnusEats = attending && body.lunch !== false;
  const guestsEating = clampGuestsEating(body.guests_eating, guestCount);
  // The shared food choice is stored only when someone is eating.
  const foodPreference = anyoneEating(alumnusEats, guestsEating)
    ? normalizeFoodPreference(body.food_preference)
    : null;

  const feeBatchRaw = body.batch != null && body.batch !== '' ? Number(body.batch) : null;
  const feeBatch = isValidBatch(feeBatchRaw) ? feeBatchRaw : me.batch;

  const breakdown = getEventCostBreakdown({
    attending,
    alumnusEats,
    batch: feeBatch ?? null,
    guestCount,
    guestsEating,
  });
  const feeTotal = breakdown.totalCost;

  const rawPhone = body.phone_number ? String(body.phone_number) : me.phone_number || '';
  const phone =
    normalizePhoneNumber(rawPhone.startsWith('+') ? rawPhone : rawPhone ? `+${rawPhone}` : '') || null;
  if (!phone) {
    return {
      status: 400,
      payload: { error: 'Enter a valid phone number with country code (ISD)' },
    };
  }
  const phoneParts = splitE164(phone);
  const phoneErr = phoneValidationError(phoneParts.isd, phoneParts.national);
  if (phoneErr) return { status: 400, payload: { error: phoneErr } };

  // Donation intent. The client sends an amount to donate, never a payable total.
  let intendedDonationPaise = 0;
  if (body.intended_donation_paise != null && body.intended_donation_paise !== '') {
    const raw = Number(body.intended_donation_paise);
    if (raw !== 0) {
      try {
        intendedDonationPaise = assertDonationAmountPaise(raw);
      } catch (err) {
        return {
          status: 400,
          payload: { error: err instanceof Error ? err.message : 'Invalid donation' },
        };
      }
    }
  }

  const { data: existingRaw } = await admin
    .from('event_registrations')
    .select('id,payment_status,amount_paid_paise,donation_id,core_committee_manually_verified')
    .eq('event_id', eventId)
    .eq('account_id', me.id)
    .in('payment_status', [...OPEN_PAYMENT_STATUSES])
    .maybeSingle();
  const existing = existingRaw as ExistingRow | null;

  const donationSync = await syncDonationIntent(admin, {
    accountId: me.id,
    eventId,
    existingDonationId: existing?.donation_id ?? null,
    intendedPaise: intendedDonationPaise,
  });
  if (!donationSync.ok) {
    return { status: donationSync.status, payload: { error: donationSync.error } };
  }
  const donation = donationSync.donation;
  const donationId = donation?.id ?? null;
  const donationDue = donationDuePaise(donation);

  // The fee's payment status. A ₹0 fee is paid at save; the donation is tracked separately.
  const priorPaid = Math.max(0, Number(existing?.amount_paid_paise) || 0);
  const payment_status = statusFromAmounts(feeTotal, priorPaid);
  const feeDue = amountDuePaise(feeTotal, priorPaid);

  const row = {
    event_id: eventId,
    account_id: me.id,
    phone_number: phone,
    number_of_guests: guestCount,
    guests_eating: guestsEating,
    attending,
    lunch: alumnusEats,
    food_preference: foodPreference,
    has_parking: hasParking,
    two_wheeler_count: twoWheelers,
    four_wheeler_count: fourWheelers,
    total_cost_paise: feeTotal,
    amount_paid_paise: priorPaid,
    payment_status,
    donation_id: donationId,
    updated_at: new Date().toISOString(),
  };

  let regId: string | undefined = existing?.id;
  if (existing?.id) {
    const { error } = await admin.from('event_registrations').update(row).eq('id', existing.id);
    if (error) {
      console.error('reg update', error);
      return {
        status: 500,
        payload: { error: error.message || 'Could not update registration' },
      };
    }
  } else {
    const { data: inserted, error } = await admin
      .from('event_registrations')
      .insert(row)
      .select('id')
      .single();
    if (error || !inserted) {
      console.error('reg insert', error);
      return {
        status: 500,
        payload: {
          error: error?.message || 'Could not save registration. Apply the event_registrations migration.',
        },
      };
    }
    regId = inserted.id as string;
  }
  if (!regId) return { status: 500, payload: { error: 'Could not save registration' } };

  // A registration whose fee and donation are both settled gets its code now.
  const registrationCode = await issueRegistrationCodeIfEligible(admin, regId, {
    paymentStatus: payment_status,
    donationDuePaise: donationDue,
    verified: Boolean(existing?.core_committee_manually_verified),
  });

  const fullName = String(body.full_name || '').trim() || me.full_name;
  const lastName = String(body.last_name || '').trim();
  const batchRaw = body.batch != null && body.batch !== '' ? Number(body.batch) : null;
  const batch = isValidBatch(batchRaw) ? batchRaw : me.batch;
  const sectionRaw = String(body.section || '').trim();
  const section = isValidSection(sectionRaw) ? sectionRaw : me.section;
  const city = String(body.city || '').trim();
  const country = String(body.country || '').trim();
  const location = formatLocation(city, country) || me.current_location || null;

  const jubilee = catalog.is_primary ? jubileeStatusFromPayment(payment_status) : undefined;
  const corePatch: Record<string, unknown> = {
    full_name: fullName,
    phone_number: phone,
    batch,
    current_location: location,
  };
  if (jubilee) corePatch.jubilee_reg_status = jubilee;

  const { error: coreError } = await admin.from('alumni_accounts').update(corePatch).eq('id', me.id);
  if (coreError) console.error('reg account core update', coreError);

  // Prefer real columns when the migration is applied. Always also pack into bio so
  // Complete payment works before last_name and section exist on alumni_accounts.
  if (lastName || section) {
    const extra: Record<string, unknown> = {};
    if (lastName) extra.last_name = lastName;
    if (section) extra.section = section;
    const { error: extraError } = await admin.from('alumni_accounts').update(extra).eq('id', me.id);
    if (extraError) {
      console.error('reg account section/last_name columns', extraError.message);
    }
    const { data: currentBio } = await admin
      .from('alumni_accounts')
      .select('bio')
      .eq('id', me.id)
      .maybeSingle();
    const { error: packedError } = await admin
      .from('alumni_accounts')
      .update({
        bio: mergeProfilePack(currentBio?.bio, {
          section: section || me.section || '',
          lastName: lastName || me.last_name || '',
        }),
      })
      .eq('id', me.id);
    if (packedError) console.error('reg account bio pack', packedError);
  }

  const totalDue = feeDue + donationDue;
  return {
    status: 200,
    payload: {
      ok: true,
      id: regId,
      payment_status,
      total_cost_paise: feeTotal,
      amount_paid_paise: priorPaid,
      fee_due_paise: feeDue,
      donation_id: donationId,
      intended_donation_paise: donation?.amount_paise ?? 0,
      donation_due_paise: donationDue,
      total_due_paise: totalDue,
      jubilee_reg_status: jubilee,
      registration_code: registrationCode,
      has_parking: hasParking,
      two_wheeler_count: twoWheelers,
      four_wheeler_count: fourWheelers,
    },
  };
}