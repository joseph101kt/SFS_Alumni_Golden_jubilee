// app/registration/page.tsx
// Registration route: owns state, effects, and the save / pay / bank-reference flow.
// Presentation lives in components/registration_page; shared logic in lib/registration.

'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { isPublicEmail, normalizeEmail } from '@/lib/email';
import { normalizePhoneNumber, phoneValidationError, splitE164, toE164 } from '@/lib/phone';
import {
    formatCostForDisplay,
    getEventCostBreakdown,
    guestsFromUnknown,
    MAX_GUESTS,
    normalizeFoodPreference,
} from '@/lib/registration/registration';
import { amountDuePaise } from '@/lib/events/balance';
import { chooseRegistrationEvent } from '@/lib/events/choose-event';
import { eventIsOpen } from '@/lib/events/open';
import type { EventCatalog } from '@/lib/events/types';
import { mergeRegistrationPrefill } from '@/lib/events/existing-registration';
import { openRazorpayCheckout } from '@/lib/payments/checkout-client';
import { formatLocation, isValidBatch, isValidSection, parseLocation } from '@/lib/registration/registration-fields';
import {
    AdminNoticeScreen,
    ChooseEventScreen,
    ConfirmPrefillScreen,
    EventUnavailableScreen,
    SignInScreen,
} from '@/components/registration_page/registration-screens';
import { RegistrationForm, type RegistrationFormMode } from '@/components/registration_page/registration-form';
import { RegistrationSuccess } from '@/components/registration_page/registration-success';
import {
    BANK_REFERENCE_ENDPOINT,
    toCheckoutOrder,
    type OrderApiResponse,
    type SaveRegistrationResponse,
    type VerifyResponse,
} from '@/lib/registration/payment-types';
import {
    choicesFingerprint,
    donationRupeesFor,
    donationValidationError,
    firstRowOf,
    parsePreRegistrationRow,
    type AuthProfile,
    type FormData,
    type PreRegistrationData,
    type RegistrationStep,
    type RegistrationUser,
} from '@/lib/registration/types';

/** Profile and registration shapes as the merge helper expects them. */
type ExistingProfile = Parameters<typeof mergeRegistrationPrefill>[0];
type ExistingRegistration = NonNullable<Parameters<typeof mergeRegistrationPrefill>[1]>;

/** Read-side fields returned by GET /api/registration/event (on top of the merged row). */
interface RegistrationReadFields {
    id?: string;
    amount_paid_paise?: number;
    amount_due_paise?: number;
    payment_status?: string;
    registration_code?: string | null;
    attending?: boolean;
    self_lunch?: boolean;
    self_preference?: string;
    guests?: unknown;
}

interface EventRegistrationResponse {
    profile: ExistingProfile;
    registration?: ExistingRegistration & RegistrationReadFields;
}

/** The attendance and food choices a saved registration restores into the form. */
type SavedChoices = Pick<FormData, 'attending' | 'self_lunch' | 'self_preference' | 'guests'>;

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

            {/* Suspense handles the inner async content */}
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
    const [formData, setFormData] = useState<FormData>({
        phone_number: '',
        full_name: '',
        last_name: '',
        section: '',
        city: '',
        country: '',
        email: '',
        attending: true,
        self_lunch: true,
        self_preference: 'veg',
        guests: [],
        donation_option: 'zero',
        donation_custom: '',
    });
    const [amountPaid, setAmountPaid] = useState(0);
    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
    const [registrationCode, setRegistrationCode] = useState<string | null>(null);
    const [lastDue, setLastDue] = useState(0);
    const [saving, setSaving] = useState(false);
    const [paying, setPaying] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [savedFingerprint, setSavedFingerprint] = useState('');
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
                self_preference: match.food_preference ?? prev.self_preference,
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

    // Pull saved profile + event registration so "Complete payment" reopens all details.
    useEffect(() => {
        if (!user?.id || !event?.id || gate !== 'ok') return;
        let active = true;
        (async () => {
            try {
                const res = await fetch(`/api/registration/event?eventId=${encodeURIComponent(event.id)}`);
                if (!res.ok || !active) return;
                const payload = (await res.json().catch(() => ({}))) as Partial<EventRegistrationResponse>;
                if (!payload.registration || !payload.profile || !active) return;

                const merged = mergeRegistrationPrefill(payload.profile, payload.registration);
                const reg = payload.registration;

                const savedChoices: SavedChoices = {
                    attending: reg.attending ?? true,
                    self_lunch: reg.self_lunch ?? true,
                    self_preference: normalizeFoodPreference(reg.self_preference),
                    guests: guestsFromUnknown(reg.guests),
                };

                setHasSavedReg(true);
                setRegistrationId(reg.id || null);
                setRegistrationCode(reg.registration_code || null);
                setAmountPaid(Math.max(0, Number(reg.amount_paid_paise) || 0));
                setPaymentStatus(merged.payment_status || null);
                const due = Math.max(0, Number(reg.amount_due_paise) || 0);
                setLastDue(due);
                if ((merged.payment_status === 'paid' || reg.payment_status === 'paid') && due === 0) {
                    setCurrentStep('success');
                }
                setSavedFingerprint(choicesFingerprint({ ...formData, ...savedChoices }));
                setFormData((prev) => ({
                    ...prev,
                    full_name: merged.full_name || prev.full_name,
                    last_name: merged.last_name || prev.last_name,
                    email: merged.email || prev.email,
                    phone_number: merged.phone_number || prev.phone_number,
                    batch: merged.batch ?? prev.batch,
                    // Prefer saved registration profile (includes bio-unpacked section).
                    section: merged.section || prev.section || '',
                    city: merged.city || prev.city,
                    country: merged.country || prev.country,
                    ...savedChoices,
                }));
                if (merged.phone_number) {
                    const split = splitE164(merged.phone_number);
                    setPhoneIsd(split.isd);
                    setPhoneNational(split.national);
                }
            } catch {
                // Keep profile/pre-reg prefill if the registration row is unavailable.
            }
        })();
        return () => {
            active = false;
        };
        // formData is intentionally excluded: this loader runs once per user/event.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, event?.id, gate]);

    const costBreakdown = getEventCostBreakdown({
        attending: formData.attending,
        selfLunch: formData.self_lunch,
        batch: formData.batch,
        guestCount: formData.guests.length,
    });

    const donationRupees = donationRupeesFor(formData);
    const registrationFeePaise = costBreakdown.totalCost;
    const donationPaise = donationRupees * 100;
    const totalCost = registrationFeePaise + donationPaise;
    const costDetailsText = costBreakdown.details;

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
        if (!formData.city.trim()) {
            setError('City is required');
            return { ok: false };
        }
        if (!formData.country.trim()) {
            setError('Country is required');
            return { ok: false };
        }
        if (!formatLocation(formData.city, formData.country)) {
            setError('City and country are required');
            return { ok: false };
        }
        if (formData.guests.length > MAX_GUESTS) {
            setError(`You can register up to ${MAX_GUESTS} guests`);
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

    /** Persist only, never opens Checkout. Returns the new amount due, or null if save failed. */
    async function saveRegistration(e?: FormEvent): Promise<number | null> {
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
            const statusRes = await fetch('/api/registration/event', {
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
                    self_lunch: formData.self_lunch,
                    self_preference: formData.self_preference,
                    guests: formData.guests,
                    number_of_guests: formData.guests.length,
                    donation_paise: donationPaise,
                }),
            });
            const statusPayload = (await statusRes.json().catch(() => ({}))) as SaveRegistrationResponse & {
                registration_code?: string | null;
            };
            if (!statusRes.ok) {
                setError(statusPayload.error || 'Could not save registration');
                setSaving(false);
                return null;
            }

            const regId = String(statusPayload.id || registrationId || '');
            const paidNow = Math.max(0, Number(statusPayload.amount_paid_paise) || 0);
            const dueNow = Math.max(
                0,
                Number(statusPayload.amount_due_paise) ??
                    amountDuePaise(Number(statusPayload.total_cost_paise) || totalCost, paidNow)
            );
            setRegistrationId(regId || null);
            setAmountPaid(paidNow);
            setPaymentStatus(String(statusPayload.payment_status || ''));
            setLastDue(dueNow);
            setHasSavedReg(true);
            setSavedFingerprint(choicesFingerprint(formData));
            setSaveMessage(
                dueNow > 0
                    ? `Saved. Amount due ${formatCostForDisplay(dueNow)}. Tap Pay when ready.`
                    : 'Saved. Your registration is up to date.'
            );
            setSaving(false);
            if (dueNow === 0 && statusPayload.payment_status === 'paid') {
                setRegistrationCode(statusPayload.registration_code ?? null);
                setCurrentStep('success');
            }
            return dueNow;
        } catch {
            setError('Could not save registration. Please try again.');
            setSaving(false);
            return null;
        }
    }

    /** Pay the due amount only. Uses the already-saved registration and does not re-save. */
    async function payDue(opts?: { due?: number; alreadySaved?: boolean }) {
        if (!user || saving || paying) return;
        setError('');
        setSaveMessage('');
        const due = opts?.due ?? lastDue;

        if (!registrationId) {
            setError('Save your registration first, then pay.');
            return;
        }
        if (!opts?.alreadySaved && choicesFingerprint(formData) !== savedFingerprint) {
            setError('You have unsaved changes. Save first, then pay.');
            return;
        }
        if (due <= 0) {
            setError('Nothing due right now.');
            return;
        }

        setPaying(true);
        try {
            const orderRes = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ registrationId }),
            });
            const orderPayload = (await orderRes.json().catch(() => ({}))) as OrderApiResponse;

            if (orderRes.status === 503 || orderPayload.configured === false) {
                setError(
                    orderPayload.error ||
                        'Payments are not configured yet. Your registration is already saved. The committee can mark payment, or try again after Razorpay keys are added.'
                );
                setPaying(false);
                return;
            }

            if (orderRes.ok && orderPayload.skipCheckout) {
                setLastDue(0);
                setPaymentStatus('paid');
                setRegistrationCode(orderPayload.registration_code || null);
                setAmountPaid(Math.max(0, Number(orderPayload.amount_paid_paise) || amountPaid));
                setPaying(false);
                setCurrentStep('success');
                return;
            }

            if (!orderRes.ok) {
                setError(orderPayload.error || 'Could not start payment. Your registration is still saved.');
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
                    registrationId,
                    razorpay_order_id: checkoutResult.razorpay_order_id,
                    razorpay_payment_id: checkoutResult.razorpay_payment_id,
                    razorpay_signature: checkoutResult.razorpay_signature,
                }),
            });
            const verifyPayload = (await verifyRes.json().catch(() => ({}))) as VerifyResponse;
            if (!verifyRes.ok) {
                setError((verifyPayload.error || 'Payment could not be verified') + ' Your registration is still saved.');
                setPaying(false);
                return;
            }
            setAmountPaid(Math.max(0, Number(verifyPayload.amount_paid_paise) || amountPaid));
            setLastDue(Math.max(0, Number(verifyPayload.amount_due_paise) || 0));
            setPaymentStatus(String(verifyPayload.payment_status || 'paid'));
            if (verifyPayload.registration_code) setRegistrationCode(String(verifyPayload.registration_code));
            setPaying(false);
            setCurrentStep('success');
        } catch {
            setError('Payment failed. Your registration is still saved. Tap Pay to try again.');
            setPaying(false);
        }
    }

    async function savePartySize() {
        const due = await saveRegistration();
        if (due == null) return;
        if (due > 0) await payDue({ due, alreadySaved: true });
    }

    /** Stores a foreign-remittance bank reference. Returns an error message, or null on success. */
    async function saveBankReference(reference: string): Promise<string | null> {
        if (!registrationId) return 'Save your registration first, then add the bank reference.';
        try {
            const res = await fetch(BANK_REFERENCE_ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ registrationId, bank_reference: reference }),
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
            self_preference: match.food_preference ?? 'veg',
        }));
        setCurrentStep('details');
    }

    function dismissPreRegistration() {
        setPreRegData(null);
        setCurrentStep('details');
    }

    const liveDue = amountDuePaise(totalCost, amountPaid);
    const formDirty = !savedFingerprint || choicesFingerprint(formData) !== savedFingerprint;
    const priceDrift = Boolean(savedFingerprint) && liveDue !== lastDue;
    const canPay = Boolean(registrationId) && lastDue > 0 && !formDirty && !priceDrift;
    const busy = saving || paying;
    const formMode: RegistrationFormMode =
        paymentStatus === 'paid' || paymentStatus === 'partial' || hasSavedReg
            ? paymentStatus === 'paid' && liveDue === 0
                ? 'update'
                : 'pay'
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
                paymentStatus={paymentStatus}
                busy={busy}
                saving={saving}
                paying={paying}
                totalCost={totalCost}
                registrationPaise={registrationFeePaise}
                donationPaise={donationPaise}
                donationRupees={donationRupees}
                costDetails={costDetailsText}
                amountPaid={amountPaid}
                liveDue={liveDue}
                lastDue={lastDue}
                canPay={canPay}
                formDirty={formDirty}
                priceDrift={priceDrift}
                registrationId={registrationId}
                registrationCode={registrationCode}
                saveMessage={saveMessage}
                error={error}
                onSaveBankReference={saveBankReference}
                onSubmit={(e) => {
                    void saveRegistration(e);
                }}
                onPay={() => void payDue()}
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
                priceDrift={priceDrift}
                liveDue={liveDue}
                lastDue={lastDue}
                totalCost={totalCost}
                amountPaid={amountPaid}
                paymentStatus={paymentStatus}
                registrationCode={registrationCode}
                costDetails={costDetailsText}
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