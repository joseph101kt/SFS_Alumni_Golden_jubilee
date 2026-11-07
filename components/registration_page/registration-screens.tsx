// components/registration_page/registration-screens.tsx
// Stateless screens shown before the form: admin notice, event picker,
// unavailable event, signed-out prompt, and pre-registration confirmation.

import Link from 'next/link';
import BackHomeLink from '@/components/back-home-link';
import { registrationPath } from '@/lib/events/choose-event';
import { eventFeeSummary } from '@/lib/events/pricing';
import type { EventCatalog } from '@/lib/events/types';
import type { PreRegistrationData } from '@/lib/registration/types';

export function AdminNoticeScreen() {
    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
            <div className="w-full max-w-lg bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low text-center">
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

export interface ChooseEventScreenProps {
    choices: EventCatalog[];
}

export function ChooseEventScreen({ choices }: ChooseEventScreenProps) {
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
                            <p className="text-label-sm text-navy-subtle mt-3">{eventFeeSummary()}</p>
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

export interface EventUnavailableScreenProps {
    message: string;
}

export function EventUnavailableScreen({ message }: EventUnavailableScreenProps) {
    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
            <div className="w-full max-w-lg bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low text-center">
                <h1 className="text-headline-lg text-primary mb-3">Event unavailable</h1>
                <p className="text-body-md text-on-surface-variant mb-8">{message}</p>
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

export interface SignInScreenProps {
    event: EventCatalog | null;
}

export function SignInScreen({ event }: SignInScreenProps) {
    const nextParam = event ? `?next=${encodeURIComponent(registrationPath(event.id))}` : '';
    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
            <div className="w-full max-w-lg">
                <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low text-center">
                    <div className="mb-6">
                        <span className="material-symbols-outlined text-[48px] text-jubilee-gold-deep mx-auto block">
                            how_to_reg
                        </span>
                    </div>

                    <h1 className="text-headline-lg text-primary mb-3">Registration Required</h1>

                    <p className="text-body-md text-on-surface-variant mb-8">
                        To register for the Golden Jubilee, you need to create an account or log in with your
                        existing account.
                    </p>

                    <div className="flex flex-col gap-3 mb-6">
                        <Link
                            href={event ? `/signup${nextParam}` : '/signup'}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-secondary-container hover:bg-secondary-fixed-dim text-on-secondary-fixed text-label-md uppercase tracking-wider shadow-md transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px]">person_add</span>
                            Create New Account
                        </Link>

                        <Link
                            href={event ? `/login${nextParam}` : '/login'}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary hover:bg-navy-subtle text-on-primary text-label-md uppercase tracking-wider shadow-md transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px]">login</span>
                            Sign In to Existing Account
                        </Link>
                    </div>

                    <p className="text-body-sm text-on-surface-variant">
                        Already have an account? Sign in to automatically prefill your registration.
                    </p>

                    <div className="mt-8">
                        <BackHomeLink signedIn={false} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export interface ConfirmPrefillScreenProps {
    preRegData: PreRegistrationData;
    onAccept: () => void;
    onReject: () => void;
}

export function ConfirmPrefillScreen({ preRegData, onAccept, onReject }: ConfirmPrefillScreenProps) {
    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20 pb-12">
            <div className="w-full max-w-3xl">
                <div className="bg-surface-paper rounded-2xl shadow-lg p-8 border border-surface-container-low">
                    <h1 className="text-headline-lg text-primary mb-2">We found your information</h1>
                    <p className="text-body-md text-on-surface-variant mb-8">
                        We found a match for your phone number, but with a different email. Is this your information?
                    </p>

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
                            <span className="text-body-md text-primary">{preRegData.batch || 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-label-md text-on-surface-variant">Section:</span>
                            <span className="text-body-md text-primary">{preRegData.section || 'Not specified'}</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onAccept}
                            className="flex-1 py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle transition-all"
                        >
                            Yes, this is correct
                        </button>
                        <button
                            type="button"
                            onClick={onReject}
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