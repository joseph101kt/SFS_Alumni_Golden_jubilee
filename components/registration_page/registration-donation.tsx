// components/registration_page/registration-donation.tsx
// Donation choice and payment route. The amount due shown is `displayMoney`: the saved figure, or a
// live preview while the form has edits. The bank reference is controlled by the page, so
// "Save changes" on the form also stores an edited reference. "Save reference" stays as a shortcut.

import { useState, type Dispatch, type SetStateAction } from 'react';
import { formatCostForDisplay } from '@/lib/registration/registration';
import { approximateInCurrency, type DisplayCurrency, type ExchangeRateState } from '@/lib/registration/currency';
import { BANK_DETAILS } from '@/lib/registration/payment-types';
import {
    DONATION_MAX_RUPEES,
    DONATION_MIN_RUPEES,
    DONATION_OPTIONS,
    donationValidationError,
    type DonationOption,
    type FormData,
    type RegistrationMoney,
} from '@/lib/registration/types';

export type PaymentRoute = 'portal' | 'bank';

const INPUT_CLASS =
    'px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50';

export interface DonationSectionProps {
    formData: FormData;
    setFormData: Dispatch<SetStateAction<FormData>>;
    busy: boolean;
    money: RegistrationMoney;
    displayMoney: RegistrationMoney;
    formDirty: boolean;
    donationLocked: boolean;
    paymentRoute: PaymentRoute;
    setPaymentRoute: (route: PaymentRoute) => void;
    /** Bank reference as the user is editing it, owned by the page. */
    bankReferenceDraft: string;
    setBankReferenceDraft: (value: string) => void;
    onSaveBankReference: (reference: string) => Promise<string | null>;
    displayCurrency: DisplayCurrency;
    exchange: ExchangeRateState;
}

export function DonationSection({
    formData,
    setFormData,
    busy,
    money,
    displayMoney,
    formDirty,
    donationLocked,
    paymentRoute,
    setPaymentRoute,
    bankReferenceDraft,
    setBankReferenceDraft,
    onSaveBankReference,
    displayCurrency,
    exchange,
}: DonationSectionProps) {
    const validationError = donationValidationError(formData);

    function chooseOption(option: DonationOption) {
        setFormData({ ...formData, donation_option: option });
    }

    function enterCustomAmount(raw: string) {
        // Digits only: negatives and decimals cannot be typed.
        setFormData({
            ...formData,
            donation_option: 'custom',
            donation_custom: raw.replace(/\D/g, ''),
        });
    }

    return (
        <section className="rounded-lg border border-outline-variant bg-surface p-6 space-y-5">
            <div>
                <h2 className="text-headline-sm text-primary uppercase tracking-wider">Donation</h2>
                <p className="text-body-sm text-on-surface-variant mt-1">Additional INR donation to fund the event:</p>
            </div>

            {donationLocked && (
                <p className="rounded-lg bg-surface-container-low px-4 py-3 text-body-sm text-on-surface">
                    Your donation is paid. To change it, contact the committee.
                </p>
            )}

            <div className="flex flex-col gap-3">
                {DONATION_OPTIONS.map((option) => (
                    <div key={option.value} className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-3">
                            <input
                                type="radio"
                                name="donation_option"
                                value={option.value}
                                checked={formData.donation_option === option.value}
                                onChange={() => chooseOption(option.value)}
                                disabled={busy || donationLocked}
                                className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-body-sm text-on-surface">{option.label}</span>
                        </label>
                        {option.value === 'custom' && (
                            <input
                                type="number"
                                inputMode="numeric"
                                min={DONATION_MIN_RUPEES}
                                max={DONATION_MAX_RUPEES}
                                step={1}
                                value={formData.donation_custom}
                                onChange={(e) => enterCustomAmount(e.target.value)}
                                placeholder={`Rs. ${DONATION_MIN_RUPEES} – ${DONATION_MAX_RUPEES.toLocaleString('en-IN')}`}
                                disabled={busy || donationLocked}
                                aria-label="Custom donation amount in rupees"
                                className={`w-56 ${INPUT_CLASS}`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {validationError && (
                <p role="alert" className="text-label-sm text-error">
                    {validationError}
                </p>
            )}

            <div className="space-y-3">
                <p className="text-label-md text-primary uppercase tracking-wider">How would you like to pay?</p>
                <label className="flex items-center gap-3">
                    <input
                        type="radio"
                        name="payment_route"
                        checked={paymentRoute === 'portal'}
                        onChange={() => setPaymentRoute('portal')}
                        className="w-4 h-4 accent-primary cursor-pointer"
                    />
                    <span className="text-body-sm text-on-surface">Pay through this portal</span>
                </label>
                <label className="flex items-center gap-3">
                    <input
                        type="radio"
                        name="payment_route"
                        checked={paymentRoute === 'bank'}
                        onChange={() => setPaymentRoute('bank')}
                        className="w-4 h-4 accent-primary cursor-pointer"
                    />
                    <span className="text-body-sm text-on-surface">
                        Direct bank transfer (recommended for remittances from abroad)
                    </span>
                </label>
            </div>

            {paymentRoute === 'bank' && (
                <BankTransferSection
                    amountDuePaise={displayMoney.totalDuePaise}
                    formDirty={formDirty}
                    busy={busy}
                    paymentStatus={money.paymentStatus}
                    bankReferenceDraft={bankReferenceDraft}
                    setBankReferenceDraft={setBankReferenceDraft}
                    onSaveBankReference={onSaveBankReference}
                    displayCurrency={displayCurrency}
                    exchange={exchange}
                />
            )}
        </section>
    );
}

interface BankTransferSectionProps {
    amountDuePaise: number;
    formDirty: boolean;
    busy: boolean;
    paymentStatus: string | null;
    bankReferenceDraft: string;
    setBankReferenceDraft: (value: string) => void;
    onSaveBankReference: (reference: string) => Promise<string | null>;
    displayCurrency: DisplayCurrency;
    exchange: ExchangeRateState;
}

function BankTransferSection({
    amountDuePaise,
    formDirty,
    busy,
    paymentStatus,
    bankReferenceDraft,
    setBankReferenceDraft,
    onSaveBankReference,
    displayCurrency,
    exchange,
}: BankTransferSectionProps) {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const canSave = bankReferenceDraft.trim().length > 0 && !saving && !busy;
    const approxDue = approximateInCurrency(amountDuePaise, displayCurrency, exchange);

    async function handleSaveReference() {
        if (!canSave) return;
        setSaving(true);
        setError('');
        setMessage('');
        const saveError = await onSaveBankReference(bankReferenceDraft.trim());
        setSaving(false);
        if (saveError) {
            setError(saveError);
            return;
        }
        setMessage(formDirty ? 'Form saved and bank reference stored.' : 'Bank reference saved.');
    }

    if (amountDuePaise <= 0) {
        return <p className="text-body-sm text-on-surface-variant">Nothing is due for bank transfer right now.</p>;
    }

    return (
        <div className="rounded-lg border border-outline-variant p-5 space-y-6">
            <div className="text-body-sm text-on-surface">
                <p>
                    Amount to remit:{' '}
                    <span className="font-semibold tabular-nums">{formatCostForDisplay(amountDuePaise)}</span> (INR)
                    {formDirty ? ' · preview, saved when you save the reference' : ''}.
                </p>
                {approxDue && (
                    <p className="text-on-surface-variant">
                        ≈ {approxDue} {displayCurrency} at the approximate reference rate. Your bank applies its own rate.
                    </p>
                )}
            </div>

            <div>
                <p className="text-label-md text-primary uppercase tracking-wider mb-2">Bank details</p>
                <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-body-sm">
                    <dt className="text-on-surface-variant">Account name</dt>
                    <dd className="text-on-surface">{BANK_DETAILS.accountName}</dd>
                    <dt className="text-on-surface-variant">Bank</dt>
                    <dd className="text-on-surface">{BANK_DETAILS.bankName}</dd>
                    <dt className="text-on-surface-variant">Branch</dt>
                    <dd className="text-on-surface">{BANK_DETAILS.branch}</dd>
                    <dt className="text-on-surface-variant">Account number</dt>
                    <dd className="text-on-surface tabular-nums">{BANK_DETAILS.accountNumber}</dd>
                    <dt className="text-on-surface-variant">IFSC code</dt>
                    <dd className="text-on-surface tabular-nums">{BANK_DETAILS.ifsc}</dd>
                    <dt className="text-on-surface-variant">SWIFT code</dt>
                    <dd className="text-on-surface tabular-nums">{BANK_DETAILS.swiftCode}</dd>
                </dl>
            </div>

            <div className="rounded-lg bg-surface-container-low px-4 py-4 text-body-sm text-on-surface space-y-2">
                <p className="font-semibold text-primary">Before you send the remittance, include these details:</p>
                <ul className="list-disc pl-5 space-y-1 text-on-surface-variant">
                    <li>Your full name, as registered on this portal</li>
                    <li>Your registration email and phone number</li>
                    <li>The amount sent (INR {formatCostForDisplay(amountDuePaise).replace(/^₹\s?/, '')})</li>
                    <li>Purpose: Golden Jubilee registration and donation</li>
                    <li>Your sender bank name, branch, and account number</li>
                </ul>
                <p className="text-on-surface-variant">
                    Enter the transaction reference or UTR number you receive from your bank in the box below. Then save.
                </p>
            </div>

            <ol className="text-body-sm text-on-surface-variant list-decimal pl-5 space-y-1">
                <li>Make the foreign remittance first, using the details above.</li>
                <li>Enter your bank payment reference below and save.</li>
            </ol>

            <div className="flex flex-col gap-3">
                <label htmlFor="bank_reference" className="text-label-md text-primary uppercase tracking-wider">
                    Bank reference
                </label>
                <textarea
                    id="bank_reference"
                    value={bankReferenceDraft}
                    onChange={(e) => setBankReferenceDraft(e.target.value)}
                    placeholder="Paste the UTR / transaction reference, and any other remittance details your bank gives you"
                    rows={5}
                    disabled={busy || saving}
                    className={`w-full min-h-[10rem] resize-y leading-relaxed ${INPUT_CLASS}`}
                />
                <p className="text-label-sm text-on-surface-variant">
                    Changes here are stored when you press Save changes below, or use the button here.
                </p>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => void handleSaveReference()}
                        disabled={!canSave}
                        className="px-8 py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle disabled:bg-surface-container disabled:text-on-surface-variant transition-all"
                    >
                        {saving ? 'Saving…' : 'Save reference'}
                    </button>
                </div>
                {message && !error && (
                    <p role="status" className="text-body-sm text-on-secondary-fixed-variant">
                        {message}
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-body-sm text-error">
                        {error}
                    </p>
                )}
            </div>

            <div className="rounded-lg bg-surface-container-low px-4 py-3 text-body-sm text-on-surface-variant space-y-2">
                <p>
                    Payments are reconciled with the bank remittance and shown as paid once it is confirmed. Please check back
                    in 3–5 business days.
                </p>
                <p>
                    Current status: <span className="font-semibold text-on-surface">{paymentStatus || 'pending'}</span>
                </p>
            </div>
        </div>
    );
}