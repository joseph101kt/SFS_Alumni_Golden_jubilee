// components/registration_page/registration-payment-summary.tsx
// Payment card. Shows the saved amounts, or a live preview while the form has unsaved edits.
// The figures are passed in; this component does no fee or donation calculation of its own.

import type { ComponentProps } from 'react';
import RefundEmailCta from '@/components/refund-email-cta';
import { formatCostForDisplay } from '@/lib/registration/registration';
import {
    approximateInCurrency,
    DISPLAY_CURRENCIES,
    type DisplayCurrency,
    type ExchangeRateState,
} from '@/lib/registration/currency';
import type { RegistrationMoney } from '@/lib/registration/types';

type RefundEmail = ComponentProps<typeof RefundEmailCta>['refundEmail'];

export interface PaymentSummaryProps {
    /** Figures to show: saved amounts, or the live preview while the form has edits. */
    money: RegistrationMoney;
    isPreview: boolean;
    refundEmail: RefundEmail;
    eventTitle: string;
    fullName: string;
    displayCurrency: DisplayCurrency;
    onCurrencyChange: (currency: DisplayCurrency) => void;
    exchange: ExchangeRateState;
}

export function PaymentSummary({
    money,
    isPreview,
    refundEmail,
    eventTitle,
    fullName,
    displayCurrency,
    onCurrencyChange,
    exchange,
}: PaymentSummaryProps) {
    const donationPaid = money.donationPaymentStatus === 'paid';
    const totalPaise = money.feeTotalPaise + money.donationIntendedPaise;
    const alreadyPaidPaise = money.feePaidPaise + (donationPaid ? money.donationIntendedPaise : 0);
    const duePaise = money.totalDuePaise;

    const approxTotal = approximateInCurrency(totalPaise, displayCurrency, exchange);
    const approxDue = approximateInCurrency(duePaise, displayCurrency, exchange);

    return (
        <section className="bg-surface-container-low rounded-lg px-6 py-6 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-headline-sm text-primary uppercase tracking-wider">Payment summary</h2>
                <span className="text-label-sm text-on-surface-variant">
                    {isPreview ? 'Preview: not saved yet' : 'Saved amounts'}
                </span>
            </div>

            <div className="flex justify-between items-center">
                <span className="text-body-md text-on-surface-variant">Registration fee</span>
                <span className="text-body-md text-on-surface tabular-nums">{formatCostForDisplay(money.feeTotalPaise)}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-body-md text-on-surface-variant">
                    Donation{donationPaid ? ' (paid)' : ''}
                </span>
                <span className="text-body-md text-on-surface tabular-nums">
                    {formatCostForDisplay(money.donationIntendedPaise)}
                </span>
            </div>
            <div className="flex justify-between items-center border-t border-outline-variant pt-3">
                <span className="text-body-md text-on-surface-variant">Total</span>
                <span className="text-headline-sm text-primary tabular-nums">{formatCostForDisplay(totalPaise)}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-body-md text-on-surface-variant">Already paid</span>
                <span className="text-body-md text-on-surface tabular-nums">{formatCostForDisplay(alreadyPaidPaise)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-outline-variant pt-3">
                <span className="text-headline-sm text-primary">Due now</span>
                <span className="text-headline-md text-jubilee-gold-deep tabular-nums">{formatCostForDisplay(duePaise)}</span>
            </div>

            {isPreview && (
                <p className="text-label-sm text-on-surface-variant">
                    These figures show your unsaved changes. Pay or save to store them.
                </p>
            )}

            <div className="rounded-lg border border-outline-variant bg-surface px-4 py-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label htmlFor="display_currency" className="text-label-md text-primary uppercase tracking-wider">
                        Show approx. in
                    </label>
                    <select
                        id="display_currency"
                        value={displayCurrency}
                        onChange={(e) => {
                            const next = DISPLAY_CURRENCIES.find((code) => code === e.target.value);
                            if (next) onCurrencyChange(next);
                        }}
                        className="px-3 py-2 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                        {DISPLAY_CURRENCIES.map((code) => (
                            <option key={code} value={code}>
                                {code}
                            </option>
                        ))}
                    </select>
                </div>

                {displayCurrency !== 'INR' && (
                    <div className="text-body-sm text-on-surface-variant">
                        {exchange.status === 'loading' && <p>Fetching approximate rate…</p>}
                        {exchange.status === 'error' && <p>Approximate rate unavailable right now.</p>}
                        {exchange.status === 'ready' && approxTotal && approxDue && (
                            <>
                                <p>
                                    Total ≈ <span className="font-semibold text-on-surface tabular-nums">{approxTotal}</span>
                                </p>
                                <p>
                                    Due now ≈ <span className="font-semibold text-on-surface tabular-nums">{approxDue}</span>
                                </p>
                            </>
                        )}
                        <p className="text-label-sm mt-1">
                            Approximate only, using the ECB reference rate
                            {exchange.status === 'ready' ? ` for ${exchange.date}` : ''} via Frankfurter. Your bank’s rate will differ.
                        </p>
                    </div>
                )}
            </div>

            <RefundEmailCta
                refundEmail={refundEmail}
                eventTitle={eventTitle}
                fullName={fullName}
                registrationCode={money.registrationCode}
                totalPaise={totalPaise}
                paidPaise={alreadyPaidPaise}
            />
        </section>
    );
}