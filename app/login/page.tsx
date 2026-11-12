// app/(auth)/login/page.tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeRegistrationNext } from '@/lib/events/choose-event';
import PasswordInput from '@/components/password-input';
import BackHomeLink from '@/components/back-home-link';

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(payload.error || 'Invalid username or password');
                setLoading(false);
                return;
            }

            const meRes = await fetch('/api/auth/me');
            const me = meRes.ok ? await meRes.json() : null;
            const next = safeRegistrationNext(searchParams.get('next'));
            if (me?.role === 'admin') {
                router.push(
                    next && (next === '/admin-app' || next.startsWith('/admin-app/') || next.startsWith('/admin-app?'))
                        ? next
                        : '/admin'
                );
            } else if (next) {
                router.push(next);
            } else if (me?.jubilee_reg_status === 'paid') {
                router.push('/member');
            } else {
                router.push('/registration');
            }
        } catch (err) {
            setError('An unexpected error occurred');
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
            <div className="w-full max-w-lg">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img
                            alt="SFS Shanthinagar Emblem"
                            className="h-12 w-auto object-contain"
                            src="/images/emblem.png"
                        />
                    </div>
                    <h1 className="text-headline-lg text-primary mb-2">Welcome Back</h1>
                    <p className="text-body-sm text-on-surface-variant">
                        Sign in to your account to register for the Alumni Meet
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-surface-paper rounded-xl shadow-md p-8 border border-surface-container-low">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="flex flex-col">
                            <label className="text-label-md text-primary mb-2 uppercase tracking-wider" htmlFor="login-username">
                                Username
                            </label>
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="you@gmail.com"
                                required
                                autoComplete="username"
                                disabled={loading}
                                className="px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:bg-surface-container disabled:text-on-surface-variant"
                            />
                            <p className="text-label-sm text-on-surface-variant mt-1">
                                Your email is your username unless you chose a different one.
                            </p>
                        </div>

                        {/* Password Field */}
                        <div className="flex flex-col">
                            <label className="text-label-md text-primary mb-2 uppercase tracking-wider" htmlFor="login-password">
                                Password
                            </label>
                            <PasswordInput
                                id="login-password"
                                value={password}
                                onChange={setPassword}
                                autoComplete="current-password"
                                required
                                disabled={loading}
                                className="px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:bg-surface-container disabled:text-on-surface-variant"
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 rounded-lg bg-error-container text-error text-body-sm">
                                {error}
                            </div>
                        )}

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle disabled:bg-surface-container disabled:text-on-surface-variant transition-all mt-6"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-outline-variant"></div>
                        <span className="text-label-sm text-on-surface-variant">OR</span>
                        <div className="flex-1 h-px bg-outline-variant"></div>
                    </div>

                    {/* Signup Link */}
                    <div className="text-center">
                        <p className="text-body-sm text-on-surface-variant mb-3">
                            Don't have an account?
                        </p>
                        <Link
                            href="/signup"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary-container hover:bg-secondary-fixed-dim text-on-secondary-fixed text-label-md uppercase tracking-wider transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px]">person_add</span>
                            Create Account
                        </Link>
                    </div>
                </div>

                {/* Forgot Password Link */}
                <div className="text-center mt-6">
                    <Link
                        href="/reset-password"
                        className="text-label-sm text-primary hover:text-navy-subtle transition-colors uppercase tracking-wider"
                    >
                        Forgot your password?
                    </Link>
                </div>

                <div className="text-center mt-8">
                    <BackHomeLink />
                </div>
            </div>
        </div>
    );
}