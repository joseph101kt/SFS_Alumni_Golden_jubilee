// app/registration/page.tsx
// Registration route. The database is the source of truth for every amount shown on load.
// Name, email and phone come from the signed-in alumni account (alumni_accounts), not from this form.
// When the committee has verified a registration, the server reports committee_confirmed and the
// page shows the confirmed state with the registration code, and no payment is asked for.
// Save changes also stores an edited bank reference. Pay saves the form first, then pays.
// On reopen, a saved bank reference restores the bank-transfer route so the user lands where they left off.
// Parking: a yes/no plus 2-wheeler and 4-wheeler counts. Total vehicles may not exceed guests + 1.

'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { normalizePhoneNumber, phoneValidationError, splitE164 } from '@/lib/phone';
import {
    clampVehicleCount,
    formatCostForDisplay,
    isEventAttending,
    MAX_GUESTS,
    vehicleCountsProblem,
} from '@/lib/registration/registration';
import { formatLocation, isValidBatch, isValidSection, parseLocation } from '@/lib/registration/registration-fields';
import { chooseRegistrationEvent } from '@/lib/events/choose-event';
import { eventIsOpen } from '@/lib/events/open';
import type { EventCatalog } from '@/lib/events/types';
import {
    mergeRegistrationPrefill,
    type ExistingRegistrationRow,
    type RegistrationPrefill,
    type RegistrationProfileSnapshot,
} from '@/lib/events/existing-registration';
import { openRazorpayCheckout } from '@/lib/payments/checkout-client';
import {
    AdminNoticeScreen,
    ChooseEventScreen,
    ConfirmPrefillScreen,
    EventUnavailableScreen,
    SignInScreen,
} from '@/components/registration_page/registration-screens';
import {
    RegistrationForm,
    type AccountContact,
    type RegistrationFormMode,
} from '@/components/registration_page/registration-form';
import { RegistrationSuccess } from '@/components/registration_page/registration-success';
import type { PaymentRoute } from '@/components/registration_page/registration-donation';
import { previewMoney } from '@/lib/registration/preview';
import {
    BANK_REFERENCE_ENDPOINT,
    toCheckoutOrder,
    type OrderApiResponse,
    type VerifyResponse,
} from '@/lib/registration/payment-types';
import {
    choicesFingerprint,
    donationFormFromPaise,
    donationIntentPaise,
    donationValidationError,
    EMPTY_FORM,
    EMPTY_MONEY,
    firstRowOf,
    moneyFromRegistration,
    parsePreRegistrationRow,
    type AuthProfile,
    type FormData,
    type PreRegistrationData,
    type RegistrationMoney,
    type RegistrationStep,
    type RegistrationUser,
} from '@/lib/registration/types';

/** A saved registration as the server reports it right now. */
interface LoadedRegistration {
    id: string;
    money: RegistrationMoney;
    committeeConfirmed: boolean;
    bankReference: string;
}

function formFromPrefill(prefill: RegistrationPrefill): FormData {
    return {
        phone_number: prefill.phone_number,
        full_name: prefill.full_name,
        last_name: prefill.last_name,
        batch: prefill.batch,
        section: prefill.section,
        city: prefill.city,
        country: prefill.country,
        email: prefill.email,
        attending: prefill.attending,
        lunch: prefill.lunch,
        food_preference: prefill.food_preference,
        number_of_guests: prefill.number_of_guests,
        guests_eating: prefill.guests_eating,
        has_parking: prefill.has_parking,
        two_wheeler_count: prefill.two_wheeler_count,
        four_wheeler_count: prefill.four_wheeler_count,
        ...donationFormFromPaise(prefill.intended_donation_paise),
    };
}

/**
 * Reads the signed-in alumni's name, email and phone from alumni_accounts.
 * Falls back to the auth profile if the row cannot be read, so registration still works.
 */
async function loadAccountContact(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    profile: AuthProfile
): Promise<AccountContact> {
    const fallback: AccountContact = {
        full_name: profile.full_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone_number: profile.phone_number || '',
    };
    try {
        const { data, error } = await supabase
            .from('alumni_accounts')
            .select('full_name, last_name, email, phone_number')
            .eq('id', userId)
            .maybeSingle();
        if (error || !data) return fallback;
        return {
            full_name: data.full_name ?? fallback.full_name,
            last_name: data.last_name ?? fallback.last_name,
            email: data.email ?? fallback.email,
            phone_number: data.phone_number ?? fallback.phone_number,
        };
    } catch {
        return fallback;
    }
}

/** Returns a message telling the user what to fix in their account, or null when the contact is usable. */
function accountContactProblem(contact: AccountContact | null): string | null {
    if (!contact) return 'Your account details are still loading. Try again in a moment.';
    if (!contact.full_name.trim()) return 'Your account has no name. Add it in your profile, then register.';
    if (!contact.email.trim()) return 'Your account has no email. Add it in your profile, then register.';
    if (!contact.phone_number.trim()) {
        return 'Your account has no phone number. Add it in your profile, then register.';
    }
    const split = splitE164(contact.phone_number);
    if (phoneValidationError(split.isd, split.national)) {
        return 'Your account phone number is not valid. Update it in your profile, then register.';
    }
    return null;
}

export default function RegistrationPage() {
    return (
        <div className="flex flex-col">
            {/* Sticky banner placed just below your global navbar */}
            <div
                className="sticky top-20 z-40 bg-yellow-400 w-full text-yellow-950 text-center font-semibold p-3 text-sm sm:text-base border-b border-yellow-500 shadow-sm"
                role="alert"
            >
                Registration is not complete until the payment made and the qr code generated
            </div>

            <Suspense
                fallback={
                    <div className="py-20 flex items-center justify-center">
                        <p className="text-body-md text-on-surface-variant">Loading...</p>
                    </div>
                }
            >
                <RegistrationPageInner />
            </Suspense>
        </div>
    );
}

function RegistrationPageInner() {
    const [user, setUser] = useState<RegistrationUser | null>(null);
    const [gate, setGate] = useState<'ok' | 'admin' | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState<RegistrationStep>('phone');
    const [error, setError] = useState('');
    const [preRegData, setPreRegData] = useState<PreRegistrationData | null>(null);
    /** Name, email and phone from the alumni account. Never typed on this form. */
    const [accountContact, setAccountContact] = useState<AccountContact | null>(null);
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    /** Amounts as the database last returned them. Never edited in the browser. */
    const [money, setMoney] = useState<RegistrationMoney>(EMPTY_MONEY);
    const [committeeConfirmed, setCommitteeConfirmed] = useState(false);
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    /** Bank reference as the database last returned it. Used to tell whether the draft has changed. */
    const [savedBankReference, setSavedBankReference] = useState('');
    /** Bank reference as the user is editing it. Saved together with the form. */
    const [bankReferenceDraft, setBankReferenceDraft] = useState('');
    /** Fingerprint of the choices as last saved. Differs from the form when edits are unsaved. */
    const [savedFingerprint, setSavedFingerprint] = useState('');
    const [paymentRoute, setPaymentRoute] = useState<PaymentRoute>('portal');
    const [saving, setSaving] = useState(false);
    const [paying, setPaying] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [event, setEvent] = useState<EventCatalog | null>(null);
    const [choices, setChoices] = useState<EventCatalog[]>([]);
    const [eventLoaded, setEventLoaded] = useState(false);
    const [eventError, setEventError] = useState('');
    const [hasSavedReg, setHasSavedReg] = useState(false);

    const searchParams = useSearchParams();
    const supabase = createClient();

    useEffect(() => {
        async function loadEvent() {
            const fromQuery = searchParams.get('event');
            setEventLoaded(false);
            try {
                if (fromQuery) {
                    const res = await fetch(`/api/events/${fromQuery}`, { cache: 'no-store' });
                    const row = res.ok ? ((await res.json()) as EventCatalog) : null;
                    if (!row || !eventIsOpen(row, new Date())) {
                        setEvent(null);
                        setEventError('This event is not available for registration.');
                        return;
                    }
                    setEvent(row);
                    setEventError('');
                    return;
                }
                const listRes = await fetch('/api/events', { cache: 'no-store' });
                if (!listRes.ok) {
                    setEventError('Events are not available yet.');
                    return;
                }
                const list = (await listRes.json()) as EventCatalog[];
                setChoices(list);
                const chosen = chooseRegistrationEvent(list);
                if (!list.length) {
                    setEvent(null);
                    setEventError('No published events are open for registration.');
                    return;
                }
                if (!chosen) {
                    setEvent(null);
                    setEventError('');
                    return;
                }
                setEvent(chosen);
                setEventError('');
            } catch {
                setEventError('Could not load event details.');
            } finally {
                setEventLoaded(true);
            }
        }
        void loadEvent();
    }, [searchParams]);

    async function prefillFromPreRegistration(phoneNumber: string, email: string) {
        if (!phoneNumber || !email) return;

        try {
            const normalized = normalizePhoneNumber(phoneNumber);
            if (!normalized) return;

            const { data, error: rpcError } = await supabase.rpc('find_pre_registration', {
                input_phone: normalized,
                input_email: email,
            });

            if (rpcError) {
                console.error('Prefill lookup error:', rpcError);
                return;
            }

            const match = parsePreRegistrationRow(firstRowOf(data));
            if (!match) return;

            // Phone-only match: ask for confirmation first.
            if (match.match_type === 'phone_only') {
                setPreRegData(match);
                setCurrentStep('confirm_prefill');
                return;
            }

            // Exact match: auto-prefill the fields this form still asks for.
            const loc = parseLocation(match.current_location || '');
            setFormData((prev) => ({
                ...prev,
                batch: match.batch || prev.batch,
                section: match.section || prev.section,
                city: loc.city || prev.city,
                country: loc.country || prev.country,
                food_preference: match.food_preference ?? prev.food_preference,
            }));
            setPreRegData(match);
            setCurrentStep('details');
        } catch (err) {
            console.error('Prefill error:', err);
        }
    }

    useEffect(() => {
        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/me');
                if (!res.ok) {
                    setLoading(false);
                    setCurrentStep('phone');
                    return;
                }

                const profile = (await res.json()) as AuthProfile;
                setUser({
                    id: profile.id,
                    email: profile.email,
                    role: profile.role,
                    jubilee_reg_status: profile.jubilee_reg_status || 'none',
                });

                if (profile.role === 'admin') {
                    setGate('admin');
                    return;
                }
                setGate('ok');

                const contact = await loadAccountContact(supabase, profile.id, profile);
                setAccountContact(contact);

                const loc = parseLocation(profile.current_location || '');
                setFormData((prev) => ({
                    ...prev,
                    batch: profile.batch ?? undefined,
                    section: profile.section || '',
                    city: loc.city,
                    country: loc.country,
                }));

                await prefillFromPreRegistration(contact.phone_number, contact.email);
                setCurrentStep('details');
            } catch {
                setCurrentStep('phone');
            } finally {
                setLoading(false);
            }
        }

        void checkAuth();
        // Runs once on mount; the prefill helper is recreated each render but only used here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Reads the saved registration and its server-calculated amounts. Used on load, after a save,
     * and after a payment. Returns null when there is no open registration for this event.
     */
    async function loadSavedRegistration(
        eventId: string,
        applyToForm: boolean
    ): Promise<LoadedRegistration | null> {
        const res = await fetch(`/api/registration/event?eventId=${encodeURIComponent(eventId)}`, {
            cache: 'no-store',
        });
        if (!res.ok) return null;

        const payload = (await res.json().catch(() => ({}))) as {
            registration?: Record<string, unknown> | null;
            profile?: RegistrationProfileSnapshot | null;
        };
        const reg = payload.registration;
        if (!reg) {
            setHasSavedReg(false);
            setRegistrationId(null);
            setMoney(EMPTY_MONEY);
            setCommitteeConfirmed(false);
            setSavedBankReference('');
            setBankReferenceDraft('');
            return null;
        }

        const id = String(reg.id ?? '');
        const next = moneyFromRegistration(reg);
        const confirmed = reg.committee_confirmed === true;
        const bankReference = typeof reg.bank_reference === 'string' ? reg.bank_reference : '';
        setRegistrationId(id || null);
        setMoney(next);
        setCommitteeConfirmed(confirmed);
        setSavedBankReference(bankReference);
        setHasSavedReg(true);

        if (applyToForm) {
            const prefill = mergeRegistrationPrefill(
                payload.profile ?? null,
                reg as unknown as ExistingRegistrationRow
            );
            const nextForm = formFromPrefill(prefill);
            setFormData(nextForm);
            setSavedFingerprint(choicesFingerprint(nextForm));
            // Show the saved reference in the box, and keep the bank route if one was saved.
            setBankReferenceDraft(bankReference);
            if (bankReference) {
                setPaymentRoute('bank');
            }
        }

        // Confirmed by the committee, or fully paid: the success screen with the code.
        if (confirmed || (next.paymentStatus === 'paid' && next.totalDuePaise === 0)) {
            setCurrentStep('success');
        }
        return { id, money: next, committeeConfirmed: confirmed, bankReference };
    }

    useEffect(() => {
        if (!user?.id || !event?.id || gate !== 'ok') return;
        void loadSavedRegistration(event.id, true);
        // Runs once per user and event. loadSavedRegistration reads no changing state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, event?.id, gate]);

    /**
     * Checks the form fields and the account contact. Returns the account's phone in E.164 for saving.
     * Name, email and phone are not typed on this form, so their errors point to the profile instead.
     */
    function validateRegistrationForm(): { ok: true; e164: string } | { ok: false } {
        const contactProblem = accountContactProblem(accountContact);
        if (contactProblem || !accountContact) {
            setError(contactProblem || 'Your account details are missing.');
            return { ok: false };
        }
        const e164 = normalizePhoneNumber(accountContact.phone_number) || accountContact.phone_number;

        if (!isValidBatch(formData.batch)) {
            setError('Select your batch year');
            return { ok: false };
        }
        if (!isValidSection(formData.section)) {
            setError('Select your section (A–D)');
            return { ok: false };
        }
        if (!formData.city.trim() || !formData.country.trim()) {
            setError('City and country are required');
            return { ok: false };
        }
        if (!formatLocation(formData.city, formData.country)) {
            setError('City and country are required');
            return { ok: false };
        }
        if (
            !Number.isInteger(formData.number_of_guests) ||
            formData.number_of_guests < 0 ||
            formData.number_of_guests > MAX_GUESTS
        ) {
            setError(`You can register up to ${MAX_GUESTS} guests`);
            return { ok: false };
        }
        if (formData.guests_eating < 0 || formData.guests_eating > formData.number_of_guests) {
            setError('Guests eating cannot be more than the number of guests');
            return { ok: false };
        }
        if (!isEventAttending(formData.attending, formData.number_of_guests)) {
            setError('Choose at least one person to attend: you or a guest');
            return { ok: false };
        }
        if (formData.has_parking) {
            const parkingError = vehicleCountsProblem(
                formData.two_wheeler_count,
                formData.four_wheeler_count,
                formData.number_of_guests
            );
            if (parkingError) {
                setError(parkingError);
                return { ok: false };
            }
        }
        const donationError = donationValidationError(formData);
        if (donationError) {
            setError(donationError);
            return { ok: false };
        }
        if (!event?.id) {
            setError('No event selected for registration');
            return { ok: false };
        }
        return { ok: true, e164 };
    }

    /** Stores the bank reference on a saved registration. Returns an error message, or null on success. */
    async function postBankReference(regId: string, reference: string): Promise<string | null> {
        try {
            const res = await fetch(BANK_REFERENCE_ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ registrationId: regId, bank_reference: reference }),
            });
            if (!res.ok) {
                const payload = (await res.json().catch(() => ({}))) as { error?: string };
                return payload.error || 'Could not save the bank reference. Please try again.';
            }
            return null;
        } catch {
            return 'Could not save the bank reference. Please try again.';
        }
    }

    /**
     * Writes the form to the database, stores the bank reference if it changed, then reloads the
     * saved amounts. Never opens checkout.
     */
    async function saveRegistration(e?: FormEvent): Promise<LoadedRegistration | null> {
        e?.preventDefault();
        if (!user || saving || paying || !event) return null;

        setSaving(true);
        setError('');
        setSaveMessage('');

        const valid = validateRegistrationForm();
        if (!valid.ok || !accountContact) {
            setSaving(false);
            return null;
        }

        // Vehicle counts only count when parking is needed; otherwise they are sent as zero.
        const twoWheelers = formData.has_parking ? clampVehicleCount(formData.two_wheeler_count) : 0;
        const fourWheelers = formData.has_parking ? clampVehicleCount(formData.four_wheeler_count) : 0;

        try {
            const res = await fetch('/api/registration/event', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    eventId: event.id,
                    phone_number: valid.e164,
                    full_name: accountContact.full_name.trim(),
                    last_name: accountContact.last_name.trim(),
                    batch: formData.batch,
                    section: formData.section,
                    city: formData.city.trim(),
                    country: formData.country.trim(),
                    attending: formData.attending,
                    lunch: formData.lunch,
                    food_preference: formData.food_preference,
                    number_of_guests: formData.number_of_guests,
                    guests_eating: formData.guests_eating,
                    has_parking: formData.has_parking,
                    two_wheeler_count: twoWheelers,
                    four_wheeler_count: fourWheelers,
                    intended_donation_paise: donationIntentPaise(formData),
                }),
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setError(payload.error || 'Could not save registration');
                setSaving(false);
                return null;
            }

            const loaded = await loadSavedRegistration(event.id, false);
            if (!loaded) {
                setError('Saved, but the amounts could not be reloaded. Refresh the page.');
                setSaving(false);
                return null;
            }

            // Store the bank reference too, but only when the bank route is in use and the text changed.
            const draft = bankReferenceDraft.trim();
            const referenceChanged = draft !== (loaded.bankReference || '').trim();
            if (paymentRoute === 'bank' && draft && referenceChanged) {
                const refError = await postBankReference(loaded.id, draft);
                if (refError) {
                    setError(`Registration saved, but ${refError.charAt(0).toLowerCase()}${refError.slice(1)}`);
                    setSavedFingerprint(choicesFingerprint(formData));
                    setSaving(false);
                    return null;
                }
                setSavedBankReference(draft);
                loaded.bankReference = draft;
            }

            setSavedFingerprint(choicesFingerprint(formData));
            setSaveMessage(
                loaded.money.totalDuePaise > 0
                    ? `Saved. Amount due ${formatCostForDisplay(loaded.money.totalDuePaise)}.`
                    : 'Saved. Nothing is due.'
            );
            setSaving(false);
            return loaded;
        } catch {
            setError('Could not save registration. Please try again.');
            setSaving(false);
            return null;
        }
    }

    /** Pays the saved registration's total (fee plus donation) in one Razorpay order. */
    async function payDue(regId: string) {
        if (!user || paying || !event?.id || !accountContact) return;
        const eventId = event.id;

        setError('');
        setSaveMessage('');
        setPaying(true);

        try {
            const orderRes = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ registrationId: regId }),
            });
            const orderPayload = (await orderRes.json().catch(() => ({}))) as OrderApiResponse & {
                skipCheckout?: boolean;
            };

            if (orderRes.status === 503 || orderPayload.configured === false) {
                setError(
                    orderPayload.error ||
                        'Payments are not configured yet. Your registration is already saved. The committee can mark payment, or try again after Razorpay keys are added.'
                );
                setPaying(false);
                return;
            }

            if (!orderRes.ok) {
                setError(orderPayload.error || 'Could not start payment. Your registration is still saved.');
                setPaying(false);
                return;
            }

            // Nothing owed online: the server settled it, so reload the saved amounts.
            if (orderPayload.skipCheckout) {
                await loadSavedRegistration(eventId, false);
                setPaying(false);
                return;
            }

            const checkoutOrder = toCheckoutOrder(orderPayload, {
                name: accountContact.full_name,
                email: accountContact.email,
                contact: normalizePhoneNumber(accountContact.phone_number) || accountContact.phone_number,
            });
            if (!checkoutOrder) {
                setError('Payment could not be started. Your registration is still saved.');
                setPaying(false);
                return;
            }

            const checkoutResult = await openRazorpayCheckout(checkoutOrder);

            if (!checkoutResult) {
                setError('Payment cancelled. Your registration is saved. Tap Pay to try again.');
                setPaying(false);
                return;
            }

            if ('failed' in checkoutResult) {
                setError(`${checkoutResult.message} Your registration is still saved.`);
                setPaying(false);
                return;
            }

            const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    registrationId: regId,
                    razorpay_order_id: checkoutResult.razorpay_order_id,
                    razorpay_payment_id: checkoutResult.razorpay_payment_id,
                    razorpay_signature: checkoutResult.razorpay_signature,
                }),
            });
            const verifyPayload = (await verifyRes.json().catch(() => ({}))) as VerifyResponse;
            if (!verifyRes.ok) {
                setError(
                    (verifyPayload.error || 'Payment could not be verified') + ' Your registration is still saved.'
                );
                setPaying(false);
                return;
            }

            const after = await loadSavedRegistration(eventId, false);
            if (after && after.money.totalDuePaise > 0) {
                setSaveMessage(`Payment received. ${formatCostForDisplay(after.money.totalDuePaise)} still due.`);
            }
            setPaying(false);
        } catch {
            setError('Payment failed. Your registration is still saved. Tap Pay to try again.');
            setPaying(false);
        }
    }

    /** Pay button: save the form first, then pay what the saved registration says is due. */
    async function payNow() {
        const loaded = await saveRegistration();
        if (!loaded) return;
        if (loaded.committeeConfirmed) return;
        if (loaded.money.totalDuePaise > 0) await payDue(loaded.id);
    }

    /** Success screen button: same as Pay. */
    async function savePartySize() {
        await payNow();
    }

    /**
     * "Save reference" button in the bank section. Saves the form first if it has unsaved edits,
     * then stores the reference. Returns an error message, or null on success.
     */
    async function saveBankReference(reference: string): Promise<string | null> {
        setBankReferenceDraft(reference);
        let regId = registrationId;
        if (formDirty || !regId) {
            const loaded = await saveRegistration();
            if (!loaded) return 'Fix the errors on the form, then save the reference again.';
            regId = loaded.id;
        }
        if (!regId) return 'Could not find your registration. Please try again.';

        const refError = await postBankReference(regId, reference.trim());
        if (refError) return refError;
        setSavedBankReference(reference.trim());
        return null;
    }

    function acceptPreRegistration(match: PreRegistrationData) {
        const loc = parseLocation(match.current_location || '');
        setFormData((prev) => ({
            ...prev,
            batch: match.batch,
            section: match.section || '',
            city: loc.city,
            country: loc.country,
            food_preference: match.food_preference ?? 'veg',
        }));
        setCurrentStep('details');
    }

    function dismissPreRegistration() {
        setPreRegData(null);
        setCurrentStep('details');
    }

    const referenceDirty = bankReferenceDraft.trim() !== savedBankReference.trim();
    const formDirty =
        (!savedFingerprint || choicesFingerprint(formData) !== savedFingerprint) || (paymentRoute === 'bank' && referenceDirty);
    // Shown amounts: the database figures until the form is edited, then a live preview.
    const displayMoney = formDirty ? previewMoney(money, formData) : money;
    const donationLocked = money.donationPaymentStatus === 'paid';
    const busy = saving || paying;
    const formMode: RegistrationFormMode = hasSavedReg
        ? money.totalDuePaise > 0
            ? 'pay'
            : 'update'
        : 'new';

    if (loading || !eventLoaded) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center pt-20">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-primary border-t-secondary-container animate-spin mx-auto mb-4"></div>
                    <p className="text-body-md text-on-surface-variant">Loading...</p>
                </div>
            </div>
        );
    }

    if (gate === 'admin') return <AdminNoticeScreen />;

    if (!event && choices.length > 1) return <ChooseEventScreen choices={choices} />;

    if (eventError && !event) return <EventUnavailableScreen message={eventError} />;

    if (!user) return <SignInScreen event={event} />;

    if (currentStep === 'confirm_prefill' && preRegData) {
        return (
            <ConfirmPrefillScreen
                preRegData={preRegData}
                onAccept={() => acceptPreRegistration(preRegData)}
                onReject={dismissPreRegistration}
            />
        );
    }

    if (currentStep === 'details') {
        return (
            <RegistrationForm
                formData={formData}
                setFormData={setFormData}
                accountContact={accountContact}
                event={event}
                formMode={formMode}
                hasSavedReg={hasSavedReg}
                busy={busy}
                saving={saving}
                paying={paying}
                money={money}
                displayMoney={displayMoney}
                formDirty={formDirty}
                donationLocked={donationLocked}
                paymentRoute={paymentRoute}
                setPaymentRoute={setPaymentRoute}
                bankReferenceDraft={bankReferenceDraft}
                setBankReferenceDraft={setBankReferenceDraft}
                savedBankReference={savedBankReference}
                saveMessage={saveMessage}
                error={error}
                onSaveBankReference={saveBankReference}
                onSubmit={(e) => {
                    void saveRegistration(e);
                }}
                onPayNow={() => void payNow()}
            />
        );
    }

    if (currentStep === 'success') {
        return (
            <RegistrationSuccess
                formData={formData}
                setFormData={setFormData}
                event={event}
                busy={busy}
                formDirty={formDirty}
                money={money}
                committeeConfirmed={committeeConfirmed}
                error={error}
                signedIn={Boolean(user)}
                onSavePartySize={() => void savePartySize()}
                onEditDetails={() => {
                    setError('');
                    setSaveMessage('');
                    setCurrentStep('details');
                }}
            />
        );
    }

    return null;
}