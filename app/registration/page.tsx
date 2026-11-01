// app/registration/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { isPublicEmail, normalizeEmail } from '@/lib/email';
import RegistrationQr from '@/components/registration-qr';
import RefundEmailCta from '@/components/refund-email-cta';
import SearchableSelect from '@/components/searchable-select';
import { COUNTRIES } from '@/lib/countries';
import {
    COUNTRY_CALLING_CODES,
    normalizePhoneNumber,
    phoneInputHint,
    phoneValidationError,
    splitE164,
    toE164,
} from '@/lib/phone';
import {
    DEFAULT_JUBILEE_PRICING,
    formatCostForDisplay,
    getEventCostBreakdown,
    normalizeFoodPreference,
    partySize,
    validateRegistrationCost,
    type EventPricing,
    type FoodPreference,
    type GuestChoice,
} from '@/lib/registration';
import { amountDuePaise } from '@/lib/events/balance';
import { chooseRegistrationEvent, registrationPath } from '@/lib/events/choose-event';
import { eventIsOpen } from '@/lib/events/open';
import {
    clampGuestMealsToPricing,
    eventToPricing,
    mealChoiceLabel,
    mealIsOffered,
    mealPriceSummary,
} from '@/lib/events/pricing';
import { mergeRegistrationPrefill } from '@/lib/events/existing-registration';
import type { EventCatalog } from '@/lib/events/types';
import { openRazorpayCheckout } from '@/lib/payments/checkout-client';
import {
    SECTIONS,
    batchYears,
    formatLocation,
    isValidBatch,
    isValidSection,
    parseLocation,
} from '@/lib/registration-fields';

const BATCH_YEARS = batchYears();
const BATCH_OPTIONS = BATCH_YEARS.map((year) => ({
    value: String(year),
    label: String(year),
}));
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }));

// Registration still uses Supabase client for optional pre_registration RPCs;
// account session is table-based via /api/auth/me.

type RegistrationStep = 'phone' | 'confirm_prefill' | 'details' | 'review' | 'success';

interface PreRegistrationData {
    id: string;
    phone_number: string;
    email: string;
    full_name: string;
    last_name?: string;
    batch?: number;
    section?: string;
    current_location?: string;
    food_preference?: FoodPreference;
    match_type: 'exact' | 'phone_only';
}

const DEFAULT_GUEST: GuestChoice = { preference: 'veg', lunch: false, dinner: false };

function resizeGuests(guests: GuestChoice[], n: number): GuestChoice[] {
    const size = partySize(n);
    if (guests.length === size) return guests;
    if (guests.length > size) return guests.slice(0, size);
    return [
        ...guests,
        ...Array.from({ length: size - guests.length }, () => ({ ...DEFAULT_GUEST })),
    ];
}

interface FormData {
    phone_number: string;
    full_name: string;
    last_name: string;
    batch?: number;
    section: string;
    city: string;
    country: string;
    email: string;
    number_of_guests: number;
    food_preference: FoodPreference;
    parking_needed: '2-wheeler' | '4-wheeler' | 'none';
    lunch: boolean;
    dinner: boolean;
    attending: boolean;
    guests: GuestChoice[];
}

export default function RegistrationPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-surface flex items-center justify-center pt-20">
                    <p className="text-body-md text-on-surface-variant">Loading...</p>
                </div>
            }
        >
            <RegistrationPageInner />
        </Suspense>
    );
}

function RegistrationPageInner() {
    const [user, setUser] = useState<any>(null);
    const [gate, setGate] = useState<'ok' | 'admin' | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState<RegistrationStep>('phone');
    const [error, setError] = useState('');
    const [preRegData, setPreRegData] = useState<PreRegistrationData | null>(null);
    const [phoneInput, setPhoneInput] = useState('');
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
        number_of_guests: 1,
        food_preference: 'veg',
        parking_needed: 'none',
        lunch: false,
        dinner: false,
        attending: true,
        guests: [{ ...DEFAULT_GUEST }],
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
    const [eventPricing, setEventPricing] = useState<EventPricing>(DEFAULT_JUBILEE_PRICING);
    const [eventError, setEventError] = useState('');
    const [hasSavedReg, setHasSavedReg] = useState(false);

    const router = useRouter();
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
                    setEventPricing(eventToPricing(row));
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
                setEventPricing(eventToPricing(chosen));
                setEventError('');
            } catch {
                setEventError('Could not load event details.');
            } finally {
                setEventLoaded(true);
            }
        }
        void loadEvent();
    }, [searchParams]);

    // Check table-based session on mount
    useEffect(() => {
        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/me');
                if (!res.ok) {
                    setLoading(false);
                    setCurrentStep('phone');
                    return;
                }

                const profile = await res.json();
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

                await prefillFromPreRegistration(
                    profile.phone_number || '',
                    profile.email || ''
                );
                setCurrentStep('details');
            } catch {
                setCurrentStep('phone');
            } finally {
                setLoading(false);
            }
        }

        checkAuth();
    }, []);

    // Pull saved profile + event registration so "Complete payment" reopens all details.
    useEffect(() => {
        if (!user?.id || !event?.id || gate !== 'ok') return;
        let active = true;
        (async () => {
            try {
                const res = await fetch(
                    `/api/registration/event?eventId=${encodeURIComponent(event.id)}`
                );
                if (!res.ok || !active) return;
                const payload = await res.json().catch(() => ({}));
                if (!payload.registration || !active) return;
                const merged = mergeRegistrationPrefill(payload.profile, payload.registration);
                const reg = payload.registration as {
                    id?: string;
                    amount_paid_paise?: number;
                    amount_due_paise?: number;
                    payment_status?: string;
                    registration_code?: string | null;
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
                const loadedChoices = {
                    number_of_guests: merged.guests.length,
                    food_preference: merged.food_preference,
                    parking_needed: merged.parking_needed,
                    lunch: merged.lunch,
                    dinner: merged.dinner,
                    attending: merged.attending,
                    guests: merged.guests,
                };
                setSavedFingerprint(
                    choicesFingerprint({
                        phone_number: '',
                        full_name: '',
                        last_name: '',
                        section: '',
                        city: '',
                        country: '',
                        email: '',
                        ...loadedChoices,
                    })
                );
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
                    ...loadedChoices,
                }));
                if (merged.phone_number) {
                    const split = splitE164(merged.phone_number);
                    setPhoneIsd(split.isd);
                    setPhoneNational(split.national);
                }
            } catch {
                // Keep profile/pre-reg prefill if registration row is unavailable.
            }
        })();
        return () => {
            active = false;
        };
    }, [user?.id, event?.id, gate]);

    // Prefill logic
    async function prefillFromPreRegistration(
        phoneNumber: string,
        email: string
    ) {
        if (!phoneNumber || !email) return;

        try {
            const normalized = normalizePhoneNumber(phoneNumber);
            if (!normalized) return;

            const { data, error } = await supabase.rpc(
                'find_pre_registration',
                {
                    input_phone: normalized,
                    input_email: email,
                }
            );

            if (error) {
                console.error('Prefill lookup error:', error);
                return;
            }

            if (data && data.length > 0) {
                const match = data[0];

                // If phone-only match, ask for confirmation
                if (match.match_type === 'phone_only') {
                    setPreRegData(match);
                    setCurrentStep('confirm_prefill');
                    return;
                }

                // Exact match: auto-prefill
                if (match.match_type === 'exact') {
                    const loc = parseLocation(match.current_location || '');
                    setFormData((prev) => ({
                        ...prev,
                        full_name: match.full_name || prev.full_name,
                        last_name: match.last_name || prev.last_name,
                        batch: match.batch || prev.batch,
                        section: match.section || prev.section,
                        city: loc.city || prev.city,
                        country: loc.country || prev.country,
                        food_preference: match.food_preference
                            ? normalizeFoodPreference(match.food_preference)
                            : prev.food_preference,
                    }));
                    setPreRegData(match);
                    setCurrentStep('details');
                }
            }
        } catch (err) {
            console.error('Prefill error:', err);
        }
    }

    // Handle phone lookup (for non-authenticated users)
    async function handlePhoneLookup(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        const normalized =
            normalizePhoneNumber(phoneInput) ||
            (phoneInput.trim().startsWith('+') ? null : normalizePhoneNumber(`+${phoneInput.trim()}`));
        if (!normalized) {
            setError('Enter phone as +ISD and number (example +919876543210)');
            return;
        }

        setLoading(true);

        try {
            // Check if this phone exists in users table
            const { data: existingUser } = await supabase
                .from('users')
                .select('email, phone_number, full_name, last_name, batch, section, current_location')
                .eq('phone_number', normalized)
                .maybeSingle();

            if (existingUser) {
                // User already registered, ask them to login
                setError(
                    'This phone number is already registered. Please log in to continue.'
                );
                setLoading(false);
                return;
            }

            // If not found, ask them to sign up
            setPhoneInput('');
            setError('');
            setLoading(false);
            return;
        } catch (err) {
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    }

    const lunchOffered = mealIsOffered(
        eventPricing.lunch_paise,
        eventPricing.lunch_nonveg_paise
    );
    const dinnerOffered = mealIsOffered(
        eventPricing.dinner_paise,
        eventPricing.dinner_nonveg_paise
    );
    const mealsOffered = lunchOffered || dinnerOffered;

    useEffect(() => {
        setFormData((prev) => {
            const next = clampGuestMealsToPricing(eventPricing, prev.guests);
            const same =
                next.length === prev.guests.length &&
                next.every(
                    (g, i) =>
                        g.preference === prev.guests[i].preference &&
                        g.lunch === prev.guests[i].lunch &&
                        g.dinner === prev.guests[i].dinner
                );
            if (same) return prev;
            const summary = next[0] || DEFAULT_GUEST;
            return {
                ...prev,
                guests: next,
                food_preference: summary.preference,
                lunch: next.some((g) => g.lunch),
                dinner: next.some((g) => g.dinner),
            };
        });
    }, [eventPricing]);

    const costBreakdown = getEventCostBreakdown(eventPricing, {
        guests: formData.guests,
        parkingNeeded: formData.parking_needed,
        batch: formData.batch ?? null,
    });
    const totalCost = costBreakdown.totalCost;

    function choicesFingerprint(data: FormData) {
        return [
            data.guests.length,
            data.parking_needed,
            data.attending,
            JSON.stringify(data.guests),
        ].join('|');
    }

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
        if (
            !validateRegistrationCost(eventPricing, {
                guests: formData.guests,
                parkingNeeded: formData.parking_needed,
                batch: formData.batch ?? null,
            })
        ) {
            setError(
                'Select lunch, dinner, or parking — or choose a batch that has a registration fee for this event'
            );
            return { ok: false };
        }
        if (!formatLocation(formData.city, formData.country)) {
            setError('City and country are required');
            return { ok: false };
        }
        if (!event?.id) {
            setError(eventError || 'No event selected for registration');
            return { ok: false };
        }
        return { ok: true, e164 };
    }

    /** Persist only — never opens Checkout. Returns the new amount due, or null if save failed. */
    async function saveRegistration(e?: React.FormEvent): Promise<number | null> {
        e?.preventDefault();
        if (!user || saving || paying) return null;

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
                    eventId: event!.id,
                    phone_number: valid.e164,
                    full_name: formData.full_name.trim(),
                    last_name: formData.last_name.trim(),
                    batch: formData.batch,
                    section: formData.section,
                    city: formData.city.trim(),
                    country: formData.country.trim(),
                    number_of_guests: formData.guests.length,
                    guests: formData.guests,
                    parking_needed: formData.parking_needed,
                    attending: formData.attending,
                }),
            });
            const statusPayload = await statusRes.json().catch(() => ({}));
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
                    ? `Saved. Amount due ${formatCostForDisplay(dueNow)} — tap Pay when ready.`
                    : 'Saved. Your registration is up to date.'
            );
            setSaving(false);
            return dueNow;
        } catch {
            setError('Could not save registration. Please try again.');
            setSaving(false);
            return null;
        }
    }

    /** Pay Due only — uses already-saved registration; does not re-save. */
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
            const orderPayload = await orderRes.json().catch(() => ({}));

            if (orderRes.status === 503 || orderPayload.configured === false) {
                setError(
                    orderPayload.error ||
                        'Payments are not configured yet. Your registration is already saved — the committee can mark payment, or try again after Razorpay keys are added.'
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
            const checkoutResult = await openRazorpayCheckout({
                orderId: orderPayload.orderId,
                amount: orderPayload.amount,
                currency: orderPayload.currency || 'INR',
                keyId: orderPayload.keyId,
                name: orderPayload.name || formData.full_name,
                email: orderPayload.email || formData.email,
                contact: orderPayload.contact || e164,
            });

            if (!checkoutResult) {
                setError('Payment cancelled. Your registration is saved — tap Pay to try again.');
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
            const verifyPayload = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) {
                setError(
                    (verifyPayload.error || 'Payment could not be verified') +
                        ' Your registration is still saved.'
                );
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
            setError('Payment failed. Your registration is still saved — tap Pay to try again.');
            setPaying(false);
        }
    }

    async function savePartySize() {
        const due = await saveRegistration();
        if (due == null) return;
        if (due > 0) await payDue({ due, alreadySaved: true });
    }

    const liveDue = amountDuePaise(totalCost, amountPaid);
    const formDirty = !savedFingerprint || choicesFingerprint(formData) !== savedFingerprint;
    const priceDrift = Boolean(savedFingerprint) && liveDue !== lastDue;
    const canPay = Boolean(registrationId) && lastDue > 0 && !formDirty && !priceDrift;
    const busy = saving || paying;
    const formMode =
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

    if (gate === 'admin') {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
                <div className="w-full max-w-md bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low text-center">
                    <span className="material-symbols-outlined text-[48px] text-jubilee-gold-deep mx-auto block mb-4">
                        admin_panel_settings
                    </span>
                    <h1 className="text-headline-lg text-primary mb-3">Committee account</h1>
                    <p className="text-body-md text-on-surface-variant mb-8">
                        Alumni committee accounts manage memberships and do not register for the reunion
                        through this form.
                    </p>
                    <Link
                        href="/admin"
                        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider"
                    >
                        Go to admin
                    </Link>
                </div>
            </div>
        );
    }

    if (!event && choices.length > 1) {
        return (
            <div className="min-h-screen bg-surface px-6 pt-28 pb-16">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-headline-lg text-primary mb-2">Choose an event</h1>
                    <p className="text-body-md text-on-surface-variant mb-8">
                        Registration is separate for each event. Pick the one you want to attend.
                    </p>
                    <div className="grid gap-4">
                        {choices.map((choice) => (
                            <article
                                key={choice.id}
                                className="rounded-2xl bg-surface-paper border border-primary/10 p-6 shadow-sm"
                            >
                                <div className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
                                    {new Date(choice.starts_at).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </div>
                                <h2 className="text-headline-sm text-primary mt-2">{choice.title}</h2>
                                <p className="text-body-sm text-navy-subtle mt-2">{choice.summary}</p>
                                <p className="text-label-sm text-navy-subtle mt-3">{mealPriceSummary(choice)}</p>
                                <Link
                                    href={registrationPath(choice.id)}
                                    className="inline-flex mt-5 rounded-lg bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed px-4 py-2.5 text-label-sm font-bold"
                                >
                                    Register
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (eventError && !event) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
                <div className="w-full max-w-md bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low text-center">
                    <h1 className="text-headline-lg text-primary mb-3">Event unavailable</h1>
                    <p className="text-body-md text-on-surface-variant mb-8">{eventError}</p>
                    <Link
                        href="/events"
                        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider"
                    >
                        View events
                    </Link>
                </div>
            </div>
        );
    }

    // Not authenticated - show login/signup card
    if (!user) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
                <div className="w-full max-w-md">
                    <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low text-center">
                        <div className="mb-6">
                            <span className="material-symbols-outlined text-[48px] text-jubilee-gold-deep mx-auto block">
                                how_to_reg
                            </span>
                        </div>

                        <h1 className="text-headline-lg text-primary mb-3">
                            Registration Required
                        </h1>

                        <p className="text-body-md text-on-surface-variant mb-8">
                            To register for the Golden Jubilee, you need to create an account or log in with your existing account.
                        </p>

                        <div className="flex flex-col gap-3 mb-6">
                            <Link
                                href={event ? `/signup?next=${encodeURIComponent(registrationPath(event.id))}` : '/signup'}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-secondary-container hover:bg-secondary-fixed-dim text-on-secondary-fixed text-label-md uppercase tracking-wider shadow-md transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    person_add
                                </span>
                                Create New Account
                            </Link>

                            <Link
                                href={event ? `/login?next=${encodeURIComponent(registrationPath(event.id))}` : '/login'}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    login
                                </span>
                                Sign In to Existing Account
                            </Link>
                        </div>

                        <p className="text-body-sm text-on-surface-variant">
                            Already have an account? Sign in to automatically prefill your registration.
                        </p>

                        <div className="mt-8">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant hover:text-primary transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    arrow_back
                                </span>
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // STEP 1: Phone confirmation (for phone-only matches)
    if (currentStep === 'confirm_prefill' && preRegData) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20 pb-12">
                <div className="w-full max-w-2xl">
                    <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                        <h1 className="text-headline-lg text-primary mb-2">
                            We found your information
                        </h1>
                        <p className="text-body-md text-on-surface-variant mb-8">
                            We found a match for your phone number, but with a different email. Is this your information?
                        </p>

                        {/* Pre-reg data display */}
                        <div className="bg-surface-container-low rounded-lg p-6 mb-6 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-label-md text-on-surface-variant">Name:</span>
                                <span className="text-body-md text-primary font-semibold">
                                    {preRegData.full_name} {preRegData.last_name}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-label-md text-on-surface-variant">Email:</span>
                                <span className="text-body-md text-primary">{preRegData.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-label-md text-on-surface-variant">Batch:</span>
                                <span className="text-body-md text-primary">
                                    {preRegData.batch || 'Not specified'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-label-md text-on-surface-variant">Section:</span>
                                <span className="text-body-md text-primary">
                                    {preRegData.section || 'Not specified'}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    // Accept and use pre-reg data
                                    const loc = parseLocation(preRegData.current_location || '');
                                    setFormData((prev) => ({
                                        ...prev,
                                        full_name: preRegData.full_name,
                                        last_name: preRegData.last_name || '',
                                        batch: preRegData.batch,
                                        section: preRegData.section || '',
                                        city: loc.city,
                                        country: loc.country,
                                        food_preference: preRegData.food_preference
                                            ? normalizeFoodPreference(preRegData.food_preference)
                                            : 'veg',
                                    }));
                                    setCurrentStep('details');
                                }}
                                className="flex-1 py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle transition-all"
                            >
                                Yes, this is correct
                            </button>
                            <button
                                onClick={() => {
                                    // Reject and continue with signup data
                                    setPreRegData(null);
                                    setCurrentStep('details');
                                }}
                                className="flex-1 py-3 rounded-lg bg-surface-container text-primary text-label-md uppercase tracking-wider font-bold hover:bg-surface-container-high transition-all"
                            >
                                No, continue anyway
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // STEP 2: Registration form
    if (currentStep === 'details') {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20 pb-12">
                <div className="w-full max-w-2xl">
                    <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                        <h1 className="text-headline-lg text-primary mb-2">
                            {formMode === 'update'
                                ? 'Update party'
                                : formMode === 'pay'
                                  ? 'Complete payment'
                                  : 'Event Registration'}
                        </h1>
                        <p
                            className={`text-body-sm text-on-surface-variant ${hasSavedReg ? 'mb-4' : 'mb-8'}`}
                        >
                            {hasSavedReg
                                ? 'Change the number of people, meals, or parking anytime. Save first — then pay only the difference if anything is due.'
                                : event
                                  ? `Register for ${event.title}`
                                  : 'Complete your registration for the Golden Jubilee'}
                        </p>
                        {hasSavedReg && (
                            <p className="rounded-xl border border-jubilee-gold-light bg-secondary-container/30 p-4 text-body-sm text-on-secondary-fixed-variant mb-8">
                                Saved registration loaded
                                {paymentStatus ? ` · status: ${paymentStatus}` : ''}. Adjust party size
                                below, tap Save, then Pay if a balance remains.
                            </p>
                        )}

                        <form onSubmit={saveRegistration} className="space-y-6">
                            {/* Personal Info Section */}
                            <div>
                                <h2 className="text-headline-sm text-primary mb-4 uppercase tracking-wider">
                                    Personal Information
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) =>
                                                setFormData({ ...formData, full_name: e.target.value })
                                            }
                                            required
                                            disabled={busy}
                                            className="px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Last Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.last_name}
                                            onChange={(e) =>
                                                setFormData({ ...formData, last_name: e.target.value })
                                            }
                                            disabled={busy}
                                            className="px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                                        />
                                    </div>

                                    <div className="md:col-span-2 flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) =>
                                                setFormData({ ...formData, email: e.target.value })
                                            }
                                            placeholder="you@gmail.com"
                                            required
                                            disabled={busy}
                                            className="px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                                        />
                                        <p className="text-label-sm text-on-surface-variant mt-1">
                                            Public email only (Gmail, Yahoo, Outlook, iCloud, Proton, Rediffmail, AOL, Zoho)
                                        </p>
                                    </div>

                                    <div className="md:col-span-2 flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Phone Number *
                                        </label>
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
                                                onChange={(e) =>
                                                    setPhoneNational(e.target.value.replace(/\D/g, ''))
                                                }
                                                placeholder="9876543210"
                                                required
                                                disabled={busy}
                                                inputMode="numeric"
                                                autoComplete="tel-national"
                                                maxLength={12}
                                                aria-label="National phone number"
                                                aria-invalid={Boolean(
                                                    phoneNational && phoneValidationError(phoneIsd, phoneNational)
                                                )}
                                                className="min-w-0 flex-1 px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                                            />
                                        </div>
                                        <p
                                            className={`text-label-sm mt-1 ${
                                                phoneNational &&
                                                phoneValidationError(phoneIsd, phoneNational)
                                                    ? 'text-error'
                                                    : 'text-on-surface-variant'
                                            }`}
                                        >
                                            {phoneNational &&
                                            phoneValidationError(phoneIsd, phoneNational)
                                                ? phoneValidationError(phoneIsd, phoneNational)
                                                : phoneInputHint(phoneIsd)}
                                        </p>
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Batch (Year) *
                                        </label>
                                        <SearchableSelect
                                            options={BATCH_OPTIONS}
                                            value={formData.batch != null ? String(formData.batch) : ''}
                                            onChange={(v) =>
                                                setFormData({
                                                    ...formData,
                                                    batch: v ? parseInt(v, 10) : undefined,
                                                })
                                            }
                                            placeholder="Type to search batch year…"
                                            required
                                            disabled={busy}
                                            aria-label="Batch year"
                                            emptyLabel="No matching batch year"
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Section *
                                        </label>
                                        <select
                                            value={formData.section}
                                            onChange={(e) =>
                                                setFormData({ ...formData, section: e.target.value })
                                            }
                                            required
                                            disabled={busy}
                                            className="px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
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
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            City *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) =>
                                                setFormData({ ...formData, city: e.target.value })
                                            }
                                            placeholder="City"
                                            required
                                            disabled={busy}
                                            className="px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Country *
                                        </label>
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

                            {/* Event Details Section */}
                            <div>
                                <h2 className="text-headline-sm text-primary mb-4 uppercase tracking-wider">
                                    Event Details
                                </h2>

                                <div className="space-y-4">
                                    <div className="flex flex-col">
                                        <label className="text-label-md text-primary mb-2 uppercase tracking-wider">
                                            Number of people *
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={formData.guests.length}
                                            onChange={(e) => {
                                                const n = partySize(parseInt(e.target.value, 10));
                                                const guests = resizeGuests(formData.guests, n);
                                                setFormData({
                                                    ...formData,
                                                    number_of_guests: guests.length,
                                                    guests,
                                                });
                                            }}
                                            required
                                            disabled={busy}
                                            className="px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
                                        />
                                        <p className="text-label-sm text-on-surface-variant mt-1">
                                            Include yourself. Set food and meals for each person below.
                                        </p>
                                    </div>

                                    {mealsOffered ? (
                                        <div className="flex flex-col gap-4">
                                            <label className="text-label-md text-primary uppercase tracking-wider">
                                                Food & meals per person *
                                            </label>
                                            {formData.guests.map((guest, index) => (
                                                <div
                                                    key={index}
                                                    className="rounded-lg border border-outline-variant bg-surface px-4 py-3 space-y-3"
                                                >
                                                    <p className="text-label-md text-primary">
                                                        {index === 0 ? 'You' : `Guest ${index + 1}`}
                                                    </p>
                                                    <div className="flex flex-wrap gap-4">
                                                        {(
                                                            [
                                                                { value: 'veg', label: 'Veg' },
                                                                { value: 'non-veg', label: 'Non-veg' },
                                                                { value: 'none', label: 'No food' },
                                                            ] as const
                                                        ).map((pref) => (
                                                            <label
                                                                key={pref.value}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`food_preference_${index}`}
                                                                    value={pref.value}
                                                                    checked={guest.preference === pref.value}
                                                                    onChange={() => {
                                                                        const guests = formData.guests.map(
                                                                            (g, i) =>
                                                                                i === index
                                                                                    ? {
                                                                                          preference: pref.value,
                                                                                          lunch:
                                                                                              pref.value === 'none'
                                                                                                  ? false
                                                                                                  : lunchOffered &&
                                                                                                    g.lunch,
                                                                                          dinner:
                                                                                              pref.value === 'none'
                                                                                                  ? false
                                                                                                  : dinnerOffered &&
                                                                                                    g.dinner,
                                                                                      }
                                                                                    : g
                                                                        );
                                                                        setFormData({ ...formData, guests });
                                                                    }}
                                                                    disabled={busy}
                                                                    className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50"
                                                                />
                                                                <span className="text-body-sm text-on-surface">
                                                                    {pref.label}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    {guest.preference !== 'none' ? (
                                                        <div className="flex flex-wrap gap-4">
                                                            {lunchOffered ? (
                                                                <label className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={guest.lunch}
                                                                        onChange={(e) => {
                                                                            const guests =
                                                                                formData.guests.map((g, i) =>
                                                                                    i === index
                                                                                        ? {
                                                                                              ...g,
                                                                                              lunch: e.target
                                                                                                  .checked,
                                                                                          }
                                                                                        : g
                                                                                );
                                                                            setFormData({
                                                                                ...formData,
                                                                                guests,
                                                                            });
                                                                        }}
                                                                        disabled={busy}
                                                                        className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50"
                                                                    />
                                                                    <span className="text-body-sm text-on-surface">
                                                                        {mealChoiceLabel(
                                                                            'Lunch',
                                                                            eventPricing.lunch_paise,
                                                                            eventPricing.lunch_nonveg_paise,
                                                                            guest.preference
                                                                        )}
                                                                    </span>
                                                                </label>
                                                            ) : null}
                                                            {dinnerOffered ? (
                                                                <label className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={guest.dinner}
                                                                        onChange={(e) => {
                                                                            const guests =
                                                                                formData.guests.map((g, i) =>
                                                                                    i === index
                                                                                        ? {
                                                                                              ...g,
                                                                                              dinner: e.target
                                                                                                  .checked,
                                                                                          }
                                                                                        : g
                                                                                );
                                                                            setFormData({
                                                                                ...formData,
                                                                                guests,
                                                                            });
                                                                        }}
                                                                        disabled={busy}
                                                                        className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50"
                                                                    />
                                                                    <span className="text-body-sm text-on-surface">
                                                                        {mealChoiceLabel(
                                                                            'Dinner',
                                                                            eventPricing.dinner_paise,
                                                                            eventPricing.dinner_nonveg_paise,
                                                                            guest.preference
                                                                        )}
                                                                    </span>
                                                                </label>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    <div className="flex flex-col">
                                        <label className="text-label-md text-primary mb-3 uppercase tracking-wider">
                                            Parking Needed *
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            {(
                                                [
                                                    { value: '2-wheeler', label: `2-Wheeler · ₹${(eventPricing.parking_2w_paise / 100).toFixed(0)}` },
                                                    { value: '4-wheeler', label: `4-Wheeler · ₹${(eventPricing.parking_4w_paise / 100).toFixed(0)}` },
                                                    { value: 'none', label: 'No Vehicle' },
                                                ] as const
                                            ).map((option) => (
                                                <label key={option.value} className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="parking"
                                                        value={option.value}
                                                        checked={
                                                            formData.parking_needed ===
                                                            (option.value as '2-wheeler' | '4-wheeler' | 'none')
                                                        }
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                parking_needed: e.target.value as
                                                                    | '2-wheeler'
                                                                    | '4-wheeler'
                                                                    | 'none',
                                                            })
                                                        }
                                                        disabled={busy}
                                                        className="w-4 h-4 accent-primary cursor-pointer disabled:opacity-50"
                                                    />
                                                    <span className="text-body-sm text-on-surface">
                                                        {option.label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cost Summary */}
                            <div className="bg-surface-container-low rounded-lg p-6 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-body-md text-on-surface-variant">Total</span>
                                    <span className="text-headline-sm text-primary tabular-nums">
                                        {formatCostForDisplay(totalCost)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-body-md text-on-surface-variant">Already paid</span>
                                    <span className="text-body-md text-on-surface tabular-nums">
                                        {formatCostForDisplay(amountPaid)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-t border-outline-variant pt-3">
                                    <span className="text-headline-sm text-primary">Due now</span>
                                    <span className="text-headline-md text-jubilee-gold-deep tabular-nums">
                                        {formatCostForDisplay(liveDue)}
                                    </span>
                                </div>
                                <p className="text-label-sm text-on-surface-variant">{costBreakdown.details}</p>
                                <RefundEmailCta
                                    refundEmail={event?.refund_email}
                                    eventTitle={event?.title || 'Event'}
                                    fullName={formData.full_name}
                                    registrationCode={registrationCode}
                                    totalPaise={totalCost}
                                    paidPaise={amountPaid}
                                />
                            </div>

                            {saveMessage && !error && (
                                <div
                                    role="status"
                                    className="p-3 rounded-lg border border-jubilee-gold-light bg-secondary-container/30 text-body-sm text-on-secondary-fixed-variant"
                                >
                                    {saveMessage}
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div
                                    role="alert"
                                    className="p-3 rounded-lg bg-error-container text-error text-body-sm"
                                >
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
                                    onClick={() => void payDue()}
                                    disabled={busy || !canPay}
                                    title={
                                        !registrationId
                                            ? 'Save first'
                                            : formDirty
                                              ? 'Save your changes before paying'
                                              : priceDrift
                                                ? 'Save so the new event rates apply before paying'
                                                : lastDue <= 0
                                                  ? 'Nothing due'
                                                  : undefined
                                    }
                                    className="flex-1 py-3 rounded-lg bg-secondary-container text-on-secondary-fixed text-label-md uppercase tracking-wider font-bold hover:bg-secondary-fixed disabled:bg-surface-container disabled:text-on-surface-variant transition-all"
                                >
                                    {paying
                                        ? 'Opening payment…'
                                        : lastDue > 0
                                          ? `Pay ${formatCostForDisplay(formDirty ? liveDue : lastDue)}`
                                          : 'Pay'}
                                </button>
                            </div>
                            {(formDirty || priceDrift) && registrationId && liveDue > 0 && (
                                <p className="text-label-sm text-on-surface-variant text-center">
                                    Save changes to unlock Pay for the updated amount.
                                </p>
                            )}
                        </form>

                        <div className="text-center mt-6">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant hover:text-primary transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    arrow_back
                                </span>
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // STEP 3: Success
    if (currentStep === 'success') {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
                <div className="w-full max-w-md text-center">
                    <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                        <div className="mb-6">
                            <span className="material-symbols-outlined text-[64px] text-green-600 mx-auto block">
                                check_circle
                            </span>
                        </div>

                        <h1 className="text-headline-lg text-primary mb-3">
                            {lastDue === 0 && paymentStatus === 'paid'
                                ? 'Registration confirmed'
                                : 'Registration saved'}
                        </h1>

                        {registrationCode && (
                            <div className="mb-6 rounded-lg border border-outline-variant bg-surface px-4 py-5">
                                <p className="text-label-md text-primary uppercase tracking-wider">
                                    Registration ID
                                </p>
                                <p className="mt-2 text-headline-md text-primary tracking-[0.18em] font-bold">
                                    {registrationCode}
                                </p>
                                <div className="mt-4 flex justify-center">
                                    <RegistrationQr code={registrationCode} />
                                </div>
                                <p className="mt-3 text-body-sm text-on-surface-variant">
                                    Show this QR code at the venue.
                                </p>
                            </div>
                        )}

                        <p className="text-body-md text-on-surface-variant mb-6">
                            {lastDue === 0 && paymentStatus === 'paid'
                                ? 'You’re confirmed. Add or remove people below — if the total goes up, you only pay the difference.'
                                : lastDue > 0
                                  ? 'Your details are saved. Complete the remaining balance when payment is available, or ask the committee to mark paid.'
                                  : 'Your registration has been updated.'}
                        </p>

                        <div className="mb-6 rounded-lg border border-outline-variant bg-surface px-4 py-3 text-left">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-label-md text-primary uppercase tracking-wider">
                                        People attending
                                    </div>
                                    <p className="text-label-sm text-on-surface-variant mt-1">Includes you</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        aria-label="Fewer people"
                                        disabled={busy || formData.guests.length <= 1}
                                        onClick={() => {
                                            const guests = resizeGuests(
                                                formData.guests,
                                                Math.max(1, formData.guests.length - 1)
                                            );
                                            setFormData({
                                                ...formData,
                                                number_of_guests: guests.length,
                                                guests,
                                            });
                                        }}
                                        className="h-11 w-11 rounded-lg border border-outline-variant text-headline-sm text-primary hover:bg-surface-container disabled:opacity-40 cursor-pointer"
                                    >
                                        −
                                    </button>
                                    <span className="w-8 text-center text-headline-sm text-primary tabular-nums">
                                        {formData.guests.length}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label="More people"
                                        disabled={busy}
                                        onClick={() => {
                                            const guests = resizeGuests(
                                                formData.guests,
                                                formData.guests.length + 1
                                            );
                                            setFormData({
                                                ...formData,
                                                number_of_guests: guests.length,
                                                guests,
                                            });
                                        }}
                                        className="h-11 w-11 rounded-lg border border-outline-variant text-headline-sm text-primary hover:bg-surface-container disabled:opacity-40 cursor-pointer"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            {formDirty && (
                                <p className="text-body-sm text-on-surface-variant mt-3">
                                    New total {formatCostForDisplay(totalCost)}.
                                    {liveDue > 0
                                        ? ` Pay ${formatCostForDisplay(liveDue)} more.`
                                        : ' Nothing more to pay.'}
                                </p>
                            )}
                            {priceDrift && !formDirty && (
                                <p className="text-body-sm text-on-surface-variant mt-3">
                                    Event rates changed. New total {formatCostForDisplay(totalCost)}.
                                    {liveDue > 0
                                        ? ` Pay ${formatCostForDisplay(liveDue)} more.`
                                        : ' Nothing more to pay.'}
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
                                <span className="text-label-md text-primary uppercase tracking-wider">
                                    Due
                                </span>
                                <span className="text-display-xl text-jubilee-gold-deep tabular-nums">
                                    {formatCostForDisplay(liveDue)}
                                </span>
                            </div>
                            <p className="text-label-sm text-on-surface-variant">{costBreakdown.details}</p>
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
                            <div
                                role="alert"
                                className="p-3 rounded-lg bg-error-container text-error text-body-sm mb-6 text-left"
                            >
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            {(formDirty || priceDrift) && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void savePartySize()}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {busy
                                        ? 'Saving…'
                                        : priceDrift && !formDirty
                                          ? liveDue > 0
                                            ? `Save and pay ${formatCostForDisplay(liveDue)}`
                                            : 'Save updated rates'
                                          : liveDue > 0
                                            ? `Save and pay ${formatCostForDisplay(liveDue)}`
                                            : 'Save party size'}
                                </button>
                            )}
                            {!formDirty && lastDue > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setError('');
                                        setSaveMessage('');
                                        setCurrentStep('details');
                                    }}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all"
                                >
                                    Back to pay balance
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setError('');
                                    setSaveMessage('');
                                    setCurrentStep('details');
                                }}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-outline-variant text-primary text-label-md uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Edit meals or parking
                            </button>
                            <Link
                                href={lastDue === 0 ? '/member' : '/'}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-outline-variant text-primary text-label-md uppercase tracking-wider transition-all"
                            >
                                {lastDue === 0 ? 'Go to alumni portal' : 'Back to Home'}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}