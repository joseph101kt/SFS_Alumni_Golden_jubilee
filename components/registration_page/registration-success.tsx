// components/registration_page/registration-success.tsx
// Confirmation screen shown after payment (or when nothing is due). Lets the
// attendee adjust their guest count; the route decides whether to save or pay the difference.

import type { Dispatch, SetStateAction } from 'react';
import BackHomeLink from '@/components/back-home-link';
import EventPushOptIn from '@/components/event-push-opt-in';
import RefundEmailCta from '@/components/refund-email-cta';
import RegistrationQr from '@/components/registration-qr';
import { formatCostForDisplay, MAX_GUESTS, MIN_GUESTS } from '@/lib/registration/registration';
import type { EventCatalog } from '@/lib/events/types';
import { resizeGuests, type FormData } from '@/lib/registration/types';

export interface RegistrationSuccessProps {
    formData: FormData;
    setFormData: Dispatch<SetStateAction<FormData>>;
    event: EventCatalog | null;
    busy: boolean;
    formDirty: boolean;
    priceDrift: boolean;
    liveDue: number;
    lastDue: number;
    totalCost: number;
    amountPaid: number;
    paymentStatus: string | null;
    registrationCode: string | null;
    costDetails: string;
    error: string;
    signedIn: boolean;
    onSavePartySize: () => void;
    onEditDetails: () => void;
}

export function RegistrationSuccess(props: RegistrationSuccessProps) {
    const {
        formData,
        setFormData,
        event,
        busy,
        formDirty,
        priceDrift,
        liveDue,
        lastDue,
        totalCost,
        amountPaid,
        paymentStatus,
        registrationCode,
        costDetails,
        error,
        signedIn,
        onSavePartySize,
        onEditDetails,
    } = props;

    const isConfirmed = lastDue === 0 && paymentStatus === 'paid';
    const guestCount = formData.guests.length;

    function changeGuestCount(requested: number) {
        setFormData({ ...formData, guests: resizeGuests(formData.guests, requested) });
    }

    function saveButtonLabel(): string {
        if (busy) return 'Saving…';
        if (priceDrift && !formDirty) {
            return liveDue > 0 ? `Save and pay ${formatCostForDisplay(liveDue)}` : 'Save updated rates';
        }
        return liveDue > 0 ? `Save and pay ${formatCostForDisplay(liveDue)}` : 'Save guest count';
    }

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
            <div className="w-full max-w-lg text-center">
                <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                    <div className="mb-6">
                        <span className="material-symbols-outlined text-[64px] text-green-600 mx-auto block">check_circle</span>
                    </div>

                    <h1 className="text-headline-lg text-primary mb-3">
                        {isConfirmed ? 'Registration confirmed' : 'Registration saved'}
                    </h1>

                    {registrationCode && (
                        <div className="mb-6 rounded-lg border border-outline-variant bg-surface px-4 py-5">
                            <p className="text-label-md text-primary uppercase tracking-wider">Registration ID</p>
                            <p className="mt-2 text-headline-md text-primary tracking-[0.18em] font-bold">{registrationCode}</p>
                            <div className="mt-4 flex justify-center">
                                <RegistrationQr code={registrationCode} />
                            </div>
                            <p className="mt-3 text-body-sm text-on-surface-variant">Show this QR code at the venue.</p>
                        </div>
                    )}

                    <div className="mb-6 text-left">
                        <EventPushOptIn auto autoRequest />
                    </div>

                    <p className="text-body-md text-on-surface-variant mb-6">
                        {isConfirmed
                            ? 'You’re confirmed. Add or remove guests below. If the total goes up, you only pay the difference.'
                            : lastDue > 0
                              ? 'Your details are saved. Complete the remaining balance when payment is available, or ask the committee to mark paid.'
                              : 'Your registration has been updated.'}
                    </p>

                    <div className="mb-6 rounded-lg border border-outline-variant bg-surface px-4 py-3 text-left">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-label-md text-primary uppercase tracking-wider">Guests</div>
                                <p className="text-label-sm text-on-surface-variant mt-1">
                                    Not including you. Maximum {MAX_GUESTS}.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label="Fewer guests"
                                    disabled={busy || guestCount <= MIN_GUESTS}
                                    onClick={() => changeGuestCount(guestCount - 1)}
                                    className="h-12 w-12 rounded-lg border border-outline-variant text-headline-sm text-primary hover:bg-surface-container disabled:opacity-40 cursor-pointer"
                                >
                                    −
                                </button>
                                <span className="w-8 text-center text-headline-sm text-primary tabular-nums">{guestCount}</span>
                                <button
                                    type="button"
                                    aria-label="More guests"
                                    disabled={busy || guestCount >= MAX_GUESTS}
                                    onClick={() => changeGuestCount(guestCount + 1)}
                                    className="h-12 w-12 rounded-lg border border-outline-variant text-headline-sm text-primary hover:bg-surface-container disabled:opacity-40 cursor-pointer"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {formDirty && (
                            <p className="text-body-sm text-on-surface-variant mt-3">
                                New total {formatCostForDisplay(totalCost)}.
                                {liveDue > 0 ? ` Pay ${formatCostForDisplay(liveDue)} more.` : ' Nothing more to pay.'}
                            </p>
                        )}
                        {priceDrift && !formDirty && (
                            <p className="text-body-sm text-on-surface-variant mt-3">
                                Event fee changed. New total {formatCostForDisplay(totalCost)}.
                                {liveDue > 0 ? ` Pay ${formatCostForDisplay(liveDue)} more.` : ' Nothing more to pay.'}
                            </p>
                        )}
                    </div>

                    <div className="bg-surface-container-low rounded-lg p-6 mb-8 text-left space-y-2">
                        <div className="flex justify-between text-body-sm">
                            <span className="text-on-surface-variant">Total</span>
                            <span className="tabular-nums">{formatCostForDisplay(totalCost)}</span>
                        </div>
                        <div className="flex justify-between text-body-sm">
                            <span className="text-on-surface-variant">Paid</span>
                            <span className="tabular-nums">{formatCostForDisplay(amountPaid)}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-outline-variant pt-2">
                            <span className="text-label-md text-primary uppercase tracking-wider">Due</span>
                            <span className="text-display-xl text-jubilee-gold-deep tabular-nums">{formatCostForDisplay(liveDue)}</span>
                        </div>
                        <p className="text-label-sm text-on-surface-variant">{costDetails}</p>
                        <RefundEmailCta
                            refundEmail={event?.refund_email}
                            eventTitle={event?.title || 'Event'}
                            fullName={formData.full_name}
                            registrationCode={registrationCode}
                            totalPaise={totalCost}
                            paidPaise={amountPaid}
                        />
                    </div>

                    {error && (
                        <div role="alert" className="p-3 rounded-lg bg-error-container text-error text-body-sm mb-6 text-left">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        {(formDirty || priceDrift) && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onSavePartySize}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {saveButtonLabel()}
                            </button>
                        )}
                        {!formDirty && lastDue > 0 && (
                            <button
                                type="button"
                                onClick={onEditDetails}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all"
                            >
                                Back to pay balance
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onEditDetails}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-outline-variant text-primary text-label-md uppercase tracking-wider transition-all cursor-pointer"
                        >
                            Edit attendance, lunch or guests
                        </button>
                        <BackHomeLink
                            signedIn={signedIn}
                            showIcon={false}
                            guestHref={lastDue === 0 ? '/member' : '/'}
                            signedInLabel="Go to alumni portal"
                            guestLabel={lastDue === 0 ? 'Go to alumni portal' : 'Back to Home'}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-outline-variant text-primary text-label-md uppercase tracking-wider transition-all"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}