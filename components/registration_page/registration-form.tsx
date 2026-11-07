// components/registration_page/registration-form.tsx
// The main details form. Holds no save/pay state of its own: values and handlers
// come from the route so the save and payment logic stays in one place.

import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import BackHomeLink from '@/components/back-home-link';
import SearchableSelect from '@/components/searchable-select';
import { DonationSection } from '@/components/registration_page/registration-donation';
import { PaymentSummary } from '@/components/registration_page/registration-payment-summary';
import { COUNTRY_CALLING_CODES, phoneInputHint, phoneValidationError } from '@/lib/phone';
import {
    EVENT_FEE_PER_PERSON_PAISE,
    formatCostForDisplay,
    MAX_GUESTS,
    MIN_GUESTS,
    type FoodPreference,
    type GuestChoice,
} from '@/lib/registration/registration';
import { SECTIONS } from '@/lib/registration/registration-fields';
import type { EventCatalog } from '@/lib/events/types';
import { useInrExchangeRate, type DisplayCurrency } from '@/lib/registration/currency';
import {
    BATCH_OPTIONS,
    COUNTRY_OPTIONS,
    isSeniorSponsoredBatch,
    resizeGuests,
    type FormData,
} from '@/lib/registration/types';

export type RegistrationFormMode = 'new' | 'pay' | 'update';

export interface RegistrationFormProps {
    formData: FormData;
    setFormData: Dispatch<SetStateAction<FormData>>;
    phoneIsd: string;
    setPhoneIsd: (value: string) => void;
    phoneNational: string;
    setPhoneNational: (value: string) => void;
    event: EventCatalog | null;
    formMode: RegistrationFormMode;
    hasSavedReg: boolean;
    paymentStatus: string | null;
    busy: boolean;
    saving: boolean;
    paying: boolean;
    totalCost: number;
    registrationPaise: number;
    donationPaise: number;
    donationRupees: number;
    costDetails: string;
    amountPaid: number;
    liveDue: number;
    lastDue: number;
    canPay: boolean;
    formDirty: boolean;
    priceDrift: boolean;
    registrationId: string | null;
    registrationCode: string | null;
    saveMessage: string;
    error: string;
    onSaveBankReference: (reference: string) => Promise<string | null>;
    onSubmit: (event: FormEvent) => void;
    onPay: () => void;
}

const INPUT_CLASS =
    'px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50';
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer disabled:opacity-50';

const FOOD_OPTIONS: ReadonlyArray<{ value: FoodPreference; label: string }> = [
    { value: 'veg', label: 'Veg' },
    { value: 'non-veg', label: 'Non-veg' },
];

interface YesNoFieldProps {
    name: string;
    legend: string;
    value: boolean;
    onChange: (next: boolean) => void;
    disabled: boolean;
}

function YesNoField({ name, legend, value, onChange, disabled }: YesNoFieldProps) {
    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="text-label-md text-primary mb-2 uppercase tracking-wider">{legend}</legend>
            <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                    <input
                        type="radio"
                        name={name}
                        checked={value}
                        onChange={() => onChange(true)}
                        disabled={disabled}
                        className={CHECKBOX_CLASS}
                    />
                    <span className="text-body-sm text-on-surface">Yes</span>
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="radio"
                        name={name}
                        checked={!value}
                        onChange={() => onChange(false)}
                        disabled={disabled}
                        className={CHECKBOX_CLASS}
                    />
                    <span className="text-body-sm text-on-surface">No</span>
                </label>
            </div>
        </fieldset>
    );
}

interface FoodChoiceFieldProps {
    name: string;
    value: FoodPreference;
    onChange: (next: FoodPreference) => void;
    disabled: boolean;
}

function FoodChoiceField({ name, value, onChange, disabled }: FoodChoiceFieldProps) {
    return (
        <div className="flex flex-wrap gap-4">
            {FOOD_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        onChange={() => onChange(option.value)}
                        disabled={disabled}
                        className={CHECKBOX_CLASS}
                    />
                    <span className="text-body-sm text-on-surface">{option.label}</span>
                </label>
            ))}
        </div>
    );
}

export function RegistrationForm(props: RegistrationFormProps) {
    const {
        formData,
        setFormData,
        phoneIsd,
        setPhoneIsd,
        phoneNational,
        setPhoneNational,
        event,
        formMode,
        hasSavedReg,
        paymentStatus,
        busy,
        saving,
        paying,
        totalCost,
        registrationPaise,
        donationPaise,
        donationRupees,
        costDetails,
        amountPaid,
        liveDue,
        lastDue,
        canPay,
        formDirty,
        priceDrift,
        registrationId,
        registrationCode,
        saveMessage,
        error,
        onSaveBankReference,
        onSubmit,
        onPay,
    } = props;

    const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('INR');
    const exchange = useInrExchangeRate(displayCurrency);

    const isSeniorSponsored = isSeniorSponsoredBatch(formData.batch);
    const phoneError = phoneNational ? phoneValidationError(phoneIsd, phoneNational) : null;
    const feeLabel = formatCostForDisplay(EVENT_FEE_PER_PERSON_PAISE);
    const showFoodQuestions = formData.attending || formData.guests.length > 0;

    function updateGuest(index: number, patch: Partial<GuestChoice>) {
        setFormData({
            ...formData,
            guests: formData.guests.map((guest, i) => (i === index ? { ...guest, ...patch } : guest)),
        });
    }

    function changeGuestCount(requested: number) {
        setFormData({ ...formData, guests: resizeGuests(formData.guests, requested) });
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 pt-20 pb-12">
            <div className="w-full max-w-3xl">
                <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                    <h1 className="text-headline-lg text-primary mb-2">
                        {formMode === 'update' ? 'Update registration' : formMode === 'pay' ? 'Complete payment' : 'Event Registration'}
                    </h1>
                    <p className={`text-body-sm text-on-surface-variant ${hasSavedReg ? 'mb-4' : 'mb-8'}`}>
                        {hasSavedReg
                            ? 'Change your attendance, lunch, or guests anytime. Save first, then pay only the difference if anything is due.'
                            : event
                              ? `Register for ${event.title}`
                              : 'Complete your registration for the Golden Jubilee'}
                    </p>
                    {hasSavedReg && (
                        <p className="rounded-xl border border-jubilee-gold-light bg-secondary-container/30 p-4 text-body-sm text-on-secondary-fixed-variant mb-8">
                            Saved registration loaded
                            {paymentStatus ? ` · status: ${paymentStatus}` : ''}. Adjust your choices below, tap Save, then
                            Pay if a balance remains.
                        </p>
                    )}

                    <form onSubmit={onSubmit} className="space-y-6">
                        {/* Personal information */}
                        <div>
                            <h2 className="text-headline-sm text-primary mb-4 uppercase tracking-wider">Personal Information</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">Full Name *</label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        required
                                        disabled={busy}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">Last Name</label>
                                    <input
                                        type="text"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        disabled={busy}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div className="md:col-span-2 flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="you@gmail.com"
                                        required
                                        disabled={busy}
                                        className={INPUT_CLASS}
                                    />
                                    <p className="text-label-sm text-on-surface-variant mt-1">
                                        Public email only (Gmail, Yahoo, Outlook, iCloud, Proton, Rediffmail, AOL, Zoho)
                                    </p>
                                </div>

                                <div className="md:col-span-2 flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">Phone Number *</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={phoneIsd}
                                            onChange={(e) => setPhoneIsd(e.target.value)}
                                            required
                                            disabled={busy}
                                            aria-label="Country calling code"
                                            className="w-[9.5rem] shrink-0 px-2 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                                        >
                                            {COUNTRY_CALLING_CODES.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="tel"
                                            value={phoneNational}
                                            onChange={(e) => setPhoneNational(e.target.value.replace(/\D/g, ''))}
                                            placeholder="9876543210"
                                            required
                                            disabled={busy}
                                            inputMode="numeric"
                                            autoComplete="tel-national"
                                            maxLength={12}
                                            aria-label="National phone number"
                                            aria-invalid={Boolean(phoneError)}
                                            className={`min-w-0 flex-1 ${INPUT_CLASS}`}
                                        />
                                    </div>
                                    <p className={`text-label-sm mt-1 ${phoneError ? 'text-error' : 'text-on-surface-variant'}`}>
                                        {phoneError ?? phoneInputHint(phoneIsd)}
                                    </p>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">Batch (Year) *</label>
                                    <SearchableSelect
                                        options={BATCH_OPTIONS}
                                        value={formData.batch != null ? String(formData.batch) : ''}
                                        onChange={(v) =>
                                            setFormData({ ...formData, batch: v ? parseInt(v, 10) : undefined })
                                        }
                                        placeholder="Type to search batch year…"
                                        required
                                        disabled={busy}
                                        aria-label="Batch year"
                                        emptyLabel="No matching batch year"
                                    />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">Section *</label>
                                    <select
                                        value={formData.section}
                                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                        required
                                        disabled={busy}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">Select section</option>
                                        {SECTIONS.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">City *</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="City"
                                        required
                                        disabled={busy}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-label-md text-primary mb-2 uppercase tracking-wider">Country *</label>
                                    <SearchableSelect
                                        options={COUNTRY_OPTIONS}
                                        value={formData.country}
                                        onChange={(v) => setFormData({ ...formData, country: v })}
                                        placeholder="Type to search country…"
                                        required
                                        disabled={busy}
                                        aria-label="Country"
                                        emptyLabel="No matching country"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Event details */}
                        <div>
                            <h2 className="text-headline-sm text-primary mb-4 uppercase tracking-wider">Event Details</h2>

                            <div className="space-y-6">
                                <YesNoField
                                    name="attending"
                                    legend="Are you going to attend?"
                                    value={formData.attending}
                                    onChange={(next) => setFormData({ ...formData, attending: next })}
                                    disabled={busy}
                                />

                                <div className="flex flex-col">
                                    <label htmlFor="guest_count" className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                        Number of guests attending the event *
                                    </label>
                                    <p className="text-label-sm text-on-surface-variant pb-3">
                                        Not including yourself. Minimum {MIN_GUESTS}, maximum {MAX_GUESTS}.
                                    </p>
                                    <input
                                        id="guest_count"
                                        type="number"
                                        min={MIN_GUESTS}
                                        max={MAX_GUESTS}
                                        step={1}
                                        value={formData.guests.length}
                                        onChange={(e) => changeGuestCount(parseInt(e.target.value, 10))}
                                        required
                                        disabled={busy}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                {showFoodQuestions && (
                                    <div className="flex flex-col gap-4">
                                        <p className="text-label-md text-primary uppercase tracking-wider">Food per person</p>

                                        {formData.attending && (
                                            <div className="rounded-lg border border-outline-variant bg-surface px-4 py-3 space-y-4">
                                                <p className="text-label-md text-primary">You</p>
                                                <YesNoField
                                                    name="self_lunch"
                                                    legend="Will you be having lunch?"
                                                    value={formData.self_lunch}
                                                    onChange={(next) => setFormData({ ...formData, self_lunch: next })}
                                                    disabled={busy}
                                                />
                                                {formData.self_lunch && (
                                                    <FoodChoiceField
                                                        name="self_preference"
                                                        value={formData.self_preference}
                                                        onChange={(next) => setFormData({ ...formData, self_preference: next })}
                                                        disabled={busy}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {formData.guests.map((guest, index) => (
                                            <div key={index} className="rounded-lg border border-outline-variant bg-surface px-4 py-3 space-y-3">
                                                <p className="text-label-md text-primary">Guest {index + 1}</p>
                                                <FoodChoiceField
                                                    name={`guest_preference_${index}`}
                                                    value={guest.preference}
                                                    onChange={(next) => updateGuest(index, { preference: next })}
                                                    disabled={busy}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-label-sm text-on-surface-variant pt-4">
                            Event fee {feeLabel} per person. Guests always pay and have lunch. You pay the fee only if you
                            attend and have lunch.
                        </p>

                        {isSeniorSponsored && (
                            <div role="note" className="p-4 rounded-lg border border-jubilee-gold-light bg-secondary-container/30 text-body-sm text-on-secondary-fixed-variant">
                                <p>
                                    Your event fee for batches 2021–26 is borne by Alumni Seniors. Guests still pay {feeLabel} each.
                                    <strong>Please bring your ID card to prove your name</strong>, which should match school records at Event
                                    Check-in.
                                </p>
                            </div>
                        )}

                        <DonationSection
                            formData={formData}
                            setFormData={setFormData}
                            busy={busy}
                            donationRupees={donationRupees}
                            liveDue={liveDue}
                            paymentStatus={paymentStatus}
                            registrationId={registrationId}
                            onSaveBankReference={onSaveBankReference}
                            displayCurrency={displayCurrency}
                            exchange={exchange}
                        />

                        <PaymentSummary
                            registrationPaise={registrationPaise}
                            donationPaise={donationPaise}
                            totalPaise={totalCost}
                            amountPaidPaise={amountPaid}
                            duePaise={liveDue}
                            costDetails={costDetails}
                            refundEmail={event?.refund_email}
                            eventTitle={event?.title || 'Event'}
                            fullName={formData.full_name}
                            registrationCode={registrationCode}
                            displayCurrency={displayCurrency}
                            onCurrencyChange={setDisplayCurrency}
                            exchange={exchange}
                        />

                        {saveMessage && !error && (
                            <div role="status" className="p-3 rounded-lg border border-jubilee-gold-light bg-secondary-container/30 text-body-sm text-on-secondary-fixed-variant">
                                {saveMessage}
                            </div>
                        )}

                        {error && (
                            <div role="alert" className="p-3 rounded-lg bg-error-container text-error text-body-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="submit"
                                disabled={busy}
                                className="flex-1 py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle disabled:bg-surface-container disabled:text-on-surface-variant transition-all"
                            >
                                {saving ? 'Saving…' : hasSavedReg ? 'Save changes' : 'Save registration'}
                            </button>
                            <button
                                type="button"
                                onClick={onPay}
                                disabled={busy || !canPay}
                                title={
                                    !registrationId
                                        ? 'Save first'
                                        : formDirty
                                          ? 'Save your changes before paying'
                                          : priceDrift
                                            ? 'Save so the updated amount applies before paying'
                                            : lastDue <= 0
                                              ? 'Nothing due'
                                              : undefined
                                }
                                className="flex-1 py-3 rounded-lg bg-secondary-container text-on-secondary-fixed text-label-md uppercase tracking-wider font-bold hover:bg-secondary-fixed disabled:bg-surface-container disabled:text-on-surface-variant transition-all"
                            >
                                {paying ? 'Opening payment…' : lastDue > 0 ? `Pay ${formatCostForDisplay(formDirty ? liveDue : lastDue)}` : 'Pay'}
                            </button>
                        </div>
                        {(formDirty || priceDrift) && registrationId && liveDue > 0 && (
                            <p className="text-label-sm text-on-surface-variant text-center">
                                Save changes to unlock Pay for the updated amount.
                            </p>
                        )}
                    </form>

                    <div className="text-center mt-6">
                        <BackHomeLink signedIn />
                    </div>
                </div>
            </div>
        </div>
    );
}