// components/registration_page/registration-success.tsx
// Confirmation screen. It shows the registration code once the registration is confirmed, either
// by full payment or by the committee's manual verification. Confirmed registrations never ask for
// payment. Amounts come from `money`, which the server returned.

import type { Dispatch, SetStateAction } from 'react';
import BackHomeLink from '@/components/back-home-link';
import EventPushOptIn from '@/components/event-push-opt-in';
import RegistrationQr from '@/components/registration-qr';
import { formatCostForDisplay, MAX_GUESTS, MIN_GUESTS } from '@/lib/registration/registration';
import type { EventCatalog } from '@/lib/events/types';
import type { FormData, RegistrationMoney } from '@/lib/registration/types';

export interface RegistrationSuccessProps {
    formData: FormData;
    setFormData: Dispatch<SetStateAction<FormData>>;
    event: EventCatalog | null;
    busy: boolean;
    formDirty: boolean;
    money: RegistrationMoney;
    /** True when the committee has verified the registration. Overrides any balance still shown. */
    committeeConfirmed: boolean;
    error: string;
    signedIn: boolean;
    onSavePartySize: () => void;
    onEditDetails: () => void;
}

export function RegistrationSuccess(props: RegistrationSuccessProps) {
    const {
        formData,
        setFormData,
        busy,
        formDirty,
        money,
        committeeConfirmed,
        error,
        signedIn,
        onSavePartySize,
        onEditDetails,
    } = props;

    const isPaidInFull = money.paymentStatus === 'paid' && money.totalDuePaise === 0;
    const isConfirmed = committeeConfirmed || isPaidInFull;
    const code = money.registrationCode;
    const canPayMore = !isConfirmed && !formDirty && money.totalDuePaise > 0;

    function changeGuestCount(raw: string) {
        const next = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, parseInt(raw, 10) || 0));
        setFormData({
            ...formData,
            number_of_guests: next,
            guests_eating: Math.min(formData.guests_eating, next),
        });
    }

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
            <div className="w-full max-w-lg text-center">
                <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                    <div className="mb-6">
                        <span className="material-symbols-outlined text-[64px] text-green-600 mx-auto block">
                            check_circle
                        </span>
                    </div>

                    <h1 className="text-headline-lg text-primary mb-3">
                        {isConfirmed ? 'Registration confirmed' : 'Registration saved'}
                    </h1>

                    {!isConfirmed && (
                        <p className="text-body-sm text-on-surface-variant mb-6">
                            {money.totalDuePaise > 0
                                ? `Amount due ${formatCostForDisplay(money.totalDuePaise)}.`
                                : 'Your registration is saved. Your registration ID appears once payment is confirmed.'}
                        </p>
                    )}

                    {isConfirmed && committeeConfirmed && !isPaidInFull && (
                        <p className="text-body-sm text-on-surface-variant mb-6">
                            The committee has confirmed your registration. No further payment is needed.
                        </p>
                    )}

                    {code && (
                        <div className="mb-6 rounded-lg border border-outline-variant bg-surface px-4 py-5">
                            <p className="text-label-md text-primary uppercase tracking-wider">Registration ID</p>
                            <p className="mt-2 text-headline-md text-primary tracking-[0.18em] font-bold">{code}</p>
                            <div className="mt-4 flex justify-center">
                                <RegistrationQr code={code} />
                            </div>
                            <p className="mt-3 text-body-sm text-on-surface-variant">Show this QR code at the venue.</p>
                        </div>
                    )}



                    {error && (
                        <div role="alert" className="p-3 rounded-lg bg-error-container text-error text-body-sm mb-6 text-left">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        {formDirty && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onSavePartySize}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {busy ? 'Saving…' : 'Save changes'}
                            </button>
                        )}
                        {canPayMore && (
                            <button
                                type="button"
                                onClick={onSavePartySize}
                                disabled={busy}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all disabled:opacity-50"
                            >
                                {busy ? 'Working…' : `Pay ${formatCostForDisplay(money.totalDuePaise)}`}
                            </button>
                        )}
                        {!isConfirmed && (
                            <button
                                type="button"
                                onClick={onEditDetails}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-outline-variant text-primary text-label-md uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Edit attendance, lunch or guests
                            </button>
                        )}
                        <BackHomeLink
                            signedIn={signedIn}
                            showIcon={false}
                            guestHref={isConfirmed ? '/member' : '/'}
                            signedInLabel="Go to alumni portal"
                            guestLabel={isConfirmed ? 'Go to alumni portal' : 'Back to Home'}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-outline-variant text-primary text-label-md uppercase tracking-wider transition-all"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}