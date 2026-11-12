// components/registration_page/registration-form.tsx
// The details form. Holds no save or payment logic: values and handlers come from the page.
// Name, email and phone come from the alumni account and are shown read-only, not typed here.
// Amounts shown are `displayMoney` (saved, or a live preview while edited). The Pay button is
// hidden when the bank-transfer route is selected.
// Parking: total vehicles (2-wheelers + 4-wheelers) cannot exceed guests + 1 (the alumnus).

import { useState, type Dispatch, type FormEvent, type SetStateAction, type KeyboardEvent } from 'react';
import BackHomeLink from '@/components/back-home-link';
import SearchableSelect from '@/components/searchable-select';
import {
    DonationSection,
    type PaymentRoute,
} from '@/components/registration_page/registration-donation';
import { PaymentSummary } from '@/components/registration_page/registration-payment-summary';
import {
    anyoneEating,
    clampGuestCount,
    clampGuestsEating,
    clampVehicleCount,
    EVENT_FEE_PER_PERSON_PAISE,
    formatCostForDisplay,
    maxVehiclesFor,
    MAX_GUESTS,
    MIN_GUESTS,
    normalizeFoodPreference,
    type FoodPreference,
} from '@/lib/registration/registration';
import { SECTIONS } from '@/lib/registration/registration-fields';
import type { EventCatalog } from '@/lib/events/types';
import { useInrExchangeRate, type DisplayCurrency } from '@/lib/registration/currency';
import {
    BATCH_OPTIONS,
    COUNTRY_OPTIONS,
    isSeniorSponsoredBatch,
    type FormData,
    type RegistrationMoney,
} from '@/lib/registration/types';

export type RegistrationFormMode = 'new' | 'pay' | 'update';

/** Name, email and phone from the signed-in alumni account (alumni_accounts). */
export interface AccountContact {
    full_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}

export interface RegistrationFormProps {
    formData: FormData;
    setFormData: Dispatch<SetStateAction<FormData>>;
    accountContact: AccountContact | null;
    event: EventCatalog | null;
    formMode: RegistrationFormMode;
    hasSavedReg: boolean;
    busy: boolean;
    saving: boolean;
    paying: boolean;
    /** Saved amounts from the database. Used for the status line only. */
    money: RegistrationMoney;
    /** Amounts to show: saved, or a live preview while the form has unsaved edits. */
    displayMoney: RegistrationMoney;
    formDirty: boolean;
    donationLocked: boolean;
    paymentRoute: PaymentRoute;
    setPaymentRoute: (route: PaymentRoute) => void;
    /** Bank reference as the user is editing it. Saved by Save changes when the bank route is used. */
    bankReferenceDraft: string;
    setBankReferenceDraft: (value: string) => void;
    /** Bank reference as last saved. */
    savedBankReference: string;
    saveMessage: string;
    error: string;
    onSaveBankReference: (reference: string) => Promise<string | null>;
    onSubmit: (event: FormEvent) => void;
    onPayNow: () => void;
}

const INPUT_CLASS =
    'px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50';
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer disabled:opacity-50';

const FOOD_OPTIONS: ReadonlyArray<{ value: FoodPreference; label: string }> = [
    { value: 'veg', label: 'Veg' },
    { value: 'non-veg', label: 'Non-veg' },
];

/**
 * Brings the two vehicle counts back under the limit, reducing 4-wheelers first, then 2-wheelers.
 * Used when guests drop or parking is switched off, so the form never holds an invalid total.
 */
function fitVehiclesWithin(twoWheelers: number, fourWheelers: number, maxTotal: number): { two: number; four: number } {
    let two = clampVehicleCount(twoWheelers);
    let four = clampVehicleCount(fourWheelers);
    let over = two + four - maxTotal;
    if (over > 0) {
        const cutFour = Math.min(four, over);
        four -= cutFour;
        over -= cutFour;
    }
    if (over > 0) {
        two = Math.max(0, two - over);
    }
    return { two, four };
}

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
        accountContact,
        event,
        formMode,
        hasSavedReg,
        busy,
        saving,
        paying,
        money,
        displayMoney,
        formDirty,
        donationLocked,
        paymentRoute,
        setPaymentRoute,
        bankReferenceDraft,
        setBankReferenceDraft,
        savedBankReference,
        saveMessage,
        error,
        onSaveBankReference,
        onSubmit,
        onPayNow,
    } = props;

    const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('INR');
    const exchange = useInrExchangeRate(displayCurrency);

    const isSeniorSponsored = isSeniorSponsoredBatch(formData.batch);
    const feeLabel = formatCostForDisplay(EVENT_FEE_PER_PERSON_PAISE);

    // Display-only: whether the food question is shown. The fee itself comes from displayMoney.
    const guestCount = clampGuestCount(formData.number_of_guests);
    const guestsEating = clampGuestsEating(formData.guests_eating, guestCount);
    const showFoodQuestion = anyoneEating(formData.attending && formData.lunch, guestsEating);

    // Parking limits: total vehicles may not exceed the people coming (alumnus + guests).
    const maxVehicles = maxVehiclesFor(guestCount);
    const twoWheelerMax = Math.max(0, maxVehicles - clampVehicleCount(formData.four_wheeler_count));
    const fourWheelerMax = Math.max(0, maxVehicles - clampVehicleCount(formData.two_wheeler_count));
    const vehicleTotal = clampVehicleCount(formData.two_wheeler_count) + clampVehicleCount(formData.four_wheeler_count);

    function changeGuestCount(raw: string) {
        const next = clampGuestCount(parseInt(raw, 10));
        const fitted = fitVehiclesWithin(formData.two_wheeler_count, formData.four_wheeler_count, maxVehiclesFor(next));
        setFormData({
            ...formData,
            number_of_guests: next,
            guests_eating: Math.min(formData.guests_eating, next),
            two_wheeler_count: formData.has_parking ? fitted.two : 0,
            four_wheeler_count: formData.has_parking ? fitted.four : 0,
        });
    }

    function changeGuestsEating(raw: string) {
        setFormData({
            ...formData,
            guests_eating: clampGuestsEating(parseInt(raw, 10), guestCount),
        });
    }

    function changeAttending(next: boolean) {
        setFormData({ ...formData, attending: next });
    }

    /** Turning parking off clears the vehicle counts so the saved data matches what is shown. */
    function changeHasParking(next: boolean) {
        setFormData({
            ...formData,
            has_parking: next,
            two_wheeler_count: next ? formData.two_wheeler_count : 0,
            four_wheeler_count: next ? formData.four_wheeler_count : 0,
        });
    }

    function changeTwoWheelerCount(raw: string) {
        const requested = clampVehicleCount(parseInt(raw, 10));
        setFormData({ ...formData, two_wheeler_count: Math.min(requested, twoWheelerMax) });
    }

    function changeFourWheelerCount(raw: string) {
        const requested = clampVehicleCount(parseInt(raw, 10));
        setFormData({ ...formData, four_wheeler_count: Math.min(requested, fourWheelerMax) });
    }

    const payLabel =
        paying
            ? 'Opening payment…'
            : displayMoney.totalDuePaise > 0
              ? `${formDirty ? 'Save & pay' : 'Pay'} ${formatCostForDisplay(displayMoney.totalDuePaise)}`
              : 'Nothing due';

    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 pt-20 pb-12">
            <div className="w-full max-w-3xl">
                <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                    <h1 className="text-headline-lg text-primary mb-2">
                        {formMode === 'update'
                            ? 'Update registration'
                            : formMode === 'pay'
                              ? 'Complete payment'
                              : 'Event Registration'}
                    </h1>
                    <p className={`text-body-sm text-on-surface-variant ${hasSavedReg ? 'mb-4' : 'mb-8'}`}>
                        {hasSavedReg
                            ? 'Change your attendance, lunch, guests, or parking anytime. Amounts update as you edit. Pay saves your changes first.'
                            : event
                              ? `Register for ${event.title}`
                              : 'Complete your registratione for the alumni meet'}
                    </p>
                    {hasSavedReg && (
                        <p className="rounded-xl border border-jubilee-gold-light bg-secondary-container/30 p-4 text-body-sm text-on-secondary-fixed-variant mb-8">
                            Saved registration loaded
                            {money.paymentStatus ? ` · status: ${money.paymentStatus}` : ''}.
                        </p>
                    )}

                    <form onSubmit={onSubmit} onKeyDown={preventEnterSubmit} className="space-y-6">
                        {/* Account details: read-only, taken from the signed-in alumni account */}
                        <div>
                            <h2 className="text-headline-sm text-primary mb-4 uppercase tracking-wider">Your Details</h2>
                            <div className="rounded-lg border border-outline-variant bg-surface-container-low px-5 py-4 space-y-3">
                                <dl className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-body-sm">
                                    <dt className="text-on-surface-variant">Name</dt>
                                    <dd className="text-on-surface">
                                        {accountContact?.full_name || '—'}
                                        {accountContact?.last_name ? ` ${accountContact.last_name}` : ''}
                                    </dd>
                                    <dt className="text-on-surface-variant">Email</dt>
                                    <dd className="text-on-surface break-all">{accountContact?.email || '—'}</dd>
                                    <dt className="text-on-surface-variant">Phone</dt>
                                    <dd className="text-on-surface tabular-nums">{accountContact?.phone_number || '—'}</dd>
                                </dl>
                            </div>
                        </div>

                        {/* Personal information */}
                        <div>
                            <h2 className="text-headline-sm text-primary mb-4 uppercase tracking-wider">Alumni Information</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    onChange={changeAttending}
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
                                        value={formData.number_of_guests}
                                        onChange={(e) => changeGuestCount(e.target.value)}
                                        required
                                        disabled={busy}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                {formData.attending && (
                                    <YesNoField
                                        name="lunch"
                                        legend="Will you be having lunch?"
                                        value={formData.lunch}
                                        onChange={(next) => setFormData({ ...formData, lunch: next })}
                                        disabled={busy}
                                    />
                                )}

                                {guestCount > 0 && (
                                    <div className="flex flex-col">
                                        <label htmlFor="guests_eating" className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            How many of your guests will have lunch?
                                        </label>
                                        <p className="text-label-sm text-on-surface-variant pb-3">Between 0 and {guestCount}.</p>
                                        <input
                                            id="guests_eating"
                                            type="number"
                                            min={0}
                                            max={guestCount}
                                            step={1}
                                            value={guestsEating}
                                            onChange={(e) => changeGuestsEating(e.target.value)}
                                            disabled={busy}
                                            className={INPUT_CLASS}
                                        />
                                    </div>
                                )}

                                {showFoodQuestion && (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-label-md text-primary uppercase tracking-wider">
                                            Food choice for everyone having lunch
                                        </p>
                                        <FoodChoiceField
                                            name="food_preference"
                                            value={normalizeFoodPreference(formData.food_preference)}
                                            onChange={(next) => setFormData({ ...formData, food_preference: next })}
                                            disabled={busy}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Parking */}
                        <div>
                            <h2 className="text-headline-sm text-primary mb-4 uppercase tracking-wider">Parking</h2>

                            <div className="space-y-6">
                                <YesNoField
                                    name="has_parking"
                                    legend="Do you need parking?"
                                    value={formData.has_parking}
                                    onChange={changeHasParking}
                                    disabled={busy}
                                />

                                {formData.has_parking && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col">
                                            <label htmlFor="two_wheeler_count" className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                                Number of 2-wheelers
                                            </label>
                                            <input
                                                id="two_wheeler_count"
                                                type="number"
                                                min={0}
                                                max={twoWheelerMax}
                                                step={1}
                                                value={formData.two_wheeler_count}
                                                onChange={(e) => changeTwoWheelerCount(e.target.value)}
                                                disabled={busy}
                                                className={INPUT_CLASS}
                                            />
                                        </div>

                                        <div className="flex flex-col">
                                            <label htmlFor="four_wheeler_count" className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                                Number of 4-wheelers
                                            </label>
                                            <input
                                                id="four_wheeler_count"
                                                type="number"
                                                min={0}
                                                max={fourWheelerMax}
                                                step={1}
                                                value={formData.four_wheeler_count}
                                                onChange={(e) => changeFourWheelerCount(e.target.value)}
                                                disabled={busy}
                                                className={INPUT_CLASS}
                                            />
                                        </div>

                                        <p className="md:col-span-2 text-label-sm text-on-surface-variant">
                                            Total vehicles (2-wheelers and 4-wheelers together) can be up to {maxVehicles}: one for
                                            you and one for each of your {guestCount} guest{guestCount === 1 ? '' : 's'}.
                                            {vehicleTotal === 0 ? ' Enter at least one vehicle.' : ` Currently ${vehicleTotal} of ${maxVehicles}.`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-label-sm text-on-surface-variant pt-4">
                            Registration fee {feeLabel} for each person attending, including guests, whether or not they have
                            lunch. Alumni from batches 2021–26 do not pay their own fee.
                        </p>

                        {isSeniorSponsored && (
                            <div role="note" className="p-4 rounded-lg border border-jubilee-gold-light bg-secondary-container/30 text-body-sm text-on-secondary-fixed-variant">
                                <p>
                                    Your event fee for batches 2021–26 is borne by Alumni Seniors. Guests still pay {feeLabel} each.{' '}
                                    <strong>Please bring your ID card to prove your name</strong>, which should match school records at
                                    Event Check-in.
                                </p>
                            </div>
                        )}

                        <DonationSection
                            formData={formData}
                            setFormData={setFormData}
                            busy={busy}
                            money={money}
                            displayMoney={displayMoney}
                            formDirty={formDirty}
                            donationLocked={donationLocked}
                            paymentRoute={paymentRoute}
                            setPaymentRoute={setPaymentRoute}
                            bankReferenceDraft={bankReferenceDraft}
                            setBankReferenceDraft={setBankReferenceDraft}
                            onSaveBankReference={onSaveBankReference}
                            displayCurrency={displayCurrency}
                            exchange={exchange}
                        />

                        <PaymentSummary
                            money={displayMoney}
                            isPreview={formDirty}
                            refundEmail={event?.refund_email}
                            eventTitle={event?.title || 'Event'}
                            fullName={accountContact?.full_name || ''}
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

                            {paymentRoute === 'portal' && (
                                <button
                                    type="button"
                                    onClick={onPayNow}
                                    disabled={busy || displayMoney.totalDuePaise <= 0}
                                    className="flex-1 py-3 rounded-lg bg-secondary-container text-on-secondary-fixed text-label-md uppercase tracking-wider font-bold hover:bg-secondary-fixed disabled:bg-surface-container disabled:text-on-surface-variant transition-all"
                                >
                                    {payLabel}
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="text-center mt-6">
                        <BackHomeLink signedIn />
                    </div>
                </div>
            </div>
        </div>
    );
}

function preventEnterSubmit(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement;
    // Let the Enter key work normally on the submit buttons and multi-line bank reference box.
    if (target instanceof HTMLButtonElement) return;
    if (target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
}