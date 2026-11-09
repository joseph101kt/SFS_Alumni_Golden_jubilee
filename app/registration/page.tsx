// app/registration/page.tsx
// Registration route. The database is the source of truth for every amount shown when the page
// loads. When the form has unsaved edits, a live preview replaces those amounts until the next save.
// Pay and Save reference always save the form first, then act on the saved registration.

'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { isPublicEmail, normalizeEmail } from '@/lib/email';
import { normalizePhoneNumber, phoneValidationError, splitE164, toE164 } from '@/lib/phone';
import { formatCostForDisplay, isEventAttending, MAX_GUESTS } from '@/lib/registration/registration';
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
import { RegistrationForm, type RegistrationFormMode } from '@/components/registration_page/registration-form';
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
        ...donationFormFromPaise(prefill.intended_donation_paise),
    };
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
    const [phoneIsd, setPhoneIsd] = useState('+91');
    const [phoneNational, setPhoneNational] = useState('');
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    /** Amounts as the database last returned them. Never edited in the browser. */
    const [money, setMoney] = useState<RegistrationMoney>(EMPTY_MONEY);
    const [registrationId, setRegistrationId] = useState<string | null>(null);
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

            // Exact match: auto-prefill.
            const loc = parseLocation(match.current_location || '');
            setFormData((prev) => ({
                ...prev,
                full_name: match.full_name || prev.full_name,
                last_name: match.last_name || prev.last_name,
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

                const split = splitE164(profile.phone_number || '');
                setPhoneIsd(split.isd);
                setPhoneNational(split.national);
                const loc = parseLocation(profile.current_location || '');
                setFormData((prev) => ({
                    ...prev,
                    email: profile.email || '',
                    phone_number: profile.phone_number || '',
                    full_name: profile.full_name || '',
                    last_name: profile.last_name || '',
                    batch: profile.batch ?? undefined,
                    section: profile.section || '',
                    city: loc.city,
                    country: loc.country,
                }));

                await prefillFromPreRegistration(profile.phone_number || '', profile.email || '');
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
            return null;
        }

        const id = String(reg.id ?? '');
        const next = moneyFromRegistration(reg);
        setRegistrationId(id || null);
        setMoney(next);
        setHasSavedReg(true);

        if (applyToForm) {
            const prefill = mergeRegistrationPrefill(
                payload.profile ?? null,
                reg as unknown as ExistingRegistrationRow
            );
            const nextForm = formFromPrefill(prefill);
            setFormData(nextForm);
            setSavedFingerprint(choicesFingerprint(nextForm));
            if (prefill.phone_number) {
                const split = splitE164(prefill.phone_number);
                setPhoneIsd(split.isd);
                setPhoneNational(split.national);
            }
        }

        if (next.paymentStatus === 'paid' && next.totalDuePaise === 0) {
            setCurrentStep('success');
        }
        return { id, money: next };
    }

    useEffect(() => {
        if (!user?.id || !event?.id || gate !== 'ok') return;
        void loadSavedRegistration(event.id, true);
        // Runs once per user and event. loadSavedRegistration reads no changing state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, event?.id, gate]);

    function validateRegistrationForm(): { ok: true; e164: string } | { ok: false } {
        const email = normalizeEmail(formData.email);
        if (!isPublicEmail(email)) {
            setError(
                'Use a public email address (Gmail, Yahoo, Outlook, iCloud, Proton, Rediffmail, AOL, or Zoho)'
            );
            return { ok: false };
        }

        const phoneErr = phoneValidationError(phoneIsd, phoneNational);
        const e164 = phoneErr ? null : toE164(phoneIsd, phoneNational);
        if (phoneErr || !e164) {
            setError(phoneErr || 'Enter a valid phone number with country code (ISD) and national number');
            return { ok: false };
        }
        if (!formData.full_name.trim()) {
            setError('Full name is required');
            return { ok: false };
        }
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

    /** Writes the form to the database, then reloads the saved amounts. Never opens checkout. */
    async function saveRegistration(e?: FormEvent): Promise<LoadedRegistration | null> {
        e?.preventDefault();
        if (!user || saving || paying || !event) return null;

        setSaving(true);
        setError('');
        setSaveMessage('');

        const valid = validateRegistrationForm();
        if (!valid.ok) {
            setSaving(false);
            return null;
        }

        try {
            const res = await fetch('/api/registration/event', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    eventId: event.id,
                    phone_number: valid.e164,
                    full_name: formData.full_name.trim(),
                    last_name: formData.last_name.trim(),
                    batch: formData.batch,
                    section: formData.section,
                    city: formData.city.trim(),
                    country: formData.country.trim(),
                    attending: formData.attending,
                    lunch: formData.lunch,
                    food_preference: formData.food_preference,
                    number_of_guests: formData.number_of_guests,
                    guests_eating: formData.guests_eating,
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
        if (!user || paying || !event?.id) return;
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

            const e164 = toE164(phoneIsd, phoneNational) || formData.phone_number;
            const checkoutOrder = toCheckoutOrder(orderPayload, {
                name: formData.full_name,
                email: formData.email,
                contact: e164,
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
        if (loaded.money.totalDuePaise > 0) await payDue(loaded.id);
    }

    /** Success screen button: same as Pay. */
    async function savePartySize() {
        await payNow();
    }

    /** Save reference: save the form first if needed, then store the reference on the saved registration. */
    async function saveBankReference(reference: string): Promise<string | null> {
        let regId = registrationId;
        if (formDirty || !regId) {
            const loaded = await saveRegistration();
            if (!loaded) return 'Fix the errors on the form, then save the reference again.';
            regId = loaded.id;
        }
        if (!regId) return 'Could not find your registration. Please try again.';

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

    function acceptPreRegistration(match: PreRegistrationData) {
        const loc = parseLocation(match.current_location || '');
        setFormData((prev) => ({
            ...prev,
            full_name: match.full_name,
            last_name: match.last_name || '',
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

    const formDirty = !savedFingerprint || choicesFingerprint(formData) !== savedFingerprint;
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
                phoneIsd={phoneIsd}
                setPhoneIsd={setPhoneIsd}
                phoneNational={phoneNational}
                setPhoneNational={setPhoneNational}
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