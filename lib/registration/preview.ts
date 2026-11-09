// lib/registration/preview.ts
// Live preview of what the form would charge, shown only while the form has unsaved edits.
// It uses the same fee rule the server uses (getEventCostBreakdown), so the numbers match.
// The server recalculates on save and again on pay. The preview is never stored or charged.

import {
    clampGuestCount,
    clampGuestsEating,
    getEventCostBreakdown,
    isEventAttending,
} from '@/lib/registration/registration';
import { donationIntentPaise, type FormData, type RegistrationMoney } from '@/lib/registration/types';

/**
 * Builds the figures the form would show if saved now. The saved registration supplies the amount
 * already paid and the donation's payment state, because the browser never decides those.
 */
export function previewMoney(saved: RegistrationMoney, form: FormData): RegistrationMoney {
    const guestCount = clampGuestCount(form.number_of_guests);
    const guestsEating = clampGuestsEating(form.guests_eating, guestCount);
    const attendanceValid = isEventAttending(form.attending, guestCount);

    const feeTotal = attendanceValid
        ? getEventCostBreakdown({
              attending: form.attending,
              alumnusEats: form.attending && form.lunch,
              batch: form.batch ?? null,
              guestCount,
              guestsEating,
          }).totalCost
        : 0;

    const feePaid = saved.feePaidPaise;
    const feeDue = Math.max(0, feeTotal - feePaid);

    // A paid donation cannot be changed from the form, so the saved figure stays.
    const donationPaid = saved.donationPaymentStatus === 'paid';
    const donationIntended = donationPaid ? saved.donationIntendedPaise : donationIntentPaise(form);
    const donationDue = donationPaid ? 0 : donationIntended;

    return {
        feeTotalPaise: feeTotal,
        feePaidPaise: feePaid,
        feeDuePaise: feeDue,
        donationIntendedPaise: donationIntended,
        donationDuePaise: donationDue,
        donationPaymentStatus: saved.donationPaymentStatus,
        totalDuePaise: feeDue + donationDue,
        paymentStatus: saved.paymentStatus,
        registrationCode: saved.registrationCode,
    };
}