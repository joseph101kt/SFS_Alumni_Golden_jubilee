'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import PasswordInput from '@/components/password-input';

type Question = { id: string; label: string };

export default function ResetPasswordRequestPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordRequestForm />
    </Suspense>
  );
}

function ResetPasswordRequestForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'verify' | 'answers' | 'password' | 'done'>('verify');
  const [username, setUsername] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [batch, setBatch] = useState('');
  const [token, setToken] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [devUrl, setDevUrl] = useState('');

  useEffect(() => {
    const q = searchParams.get('email');
    if (q) setUsername(q);
  }, [searchParams]);

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/recover/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, phoneLast4, batch: batch || undefined }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not verify');
        return;
      }
      setToken(String(payload.token || ''));
      const qs = Array.isArray(payload.questions) ? payload.questions : [];
      setQuestions(qs);
      if (payload.needsAnswers && qs.length) {
        setStep('answers');
      } else {
        setStep('password');
      }
    } catch {
      setError('Could not verify');
    } finally {
      setLoading(false);
    }
  }

  async function onAnswers(e: FormEvent) {
    e.preventDefault();
    setStep('password');
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/recover/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, answers, password, confirm }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not reset password');
        return;
      }
      setStep('done');
    } catch {
      setError('Could not reset password');
    } finally {
      setLoading(false);
    }
  }

  async function onEmailLink(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmailMsg('');
    setDevUrl('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailHint || username }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not send reset link');
        return;
      }
      setEmailMsg(payload.message || 'If that email is registered, we sent a reset link.');
      if (typeof payload.devResetUrl === 'string') setDevUrl(payload.devResetUrl);
    } catch {
      setError('Could not send reset link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20 pb-16">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              alt="SFS Shanthinagar Emblem"
              className="h-12 w-auto object-contain"
              src="/images/emblem.png"
            />
          </div>
          <h1 className="text-headline-lg text-primary mb-2">Reset password</h1>
          <p className="text-body-sm text-on-surface-variant">
            Verify with your phone (and recovery questions if you set them). No email domain required.
          </p>
        </div>

        <div className="bg-surface-paper rounded-xl shadow-md p-8 border border-surface-container-low">
          {step === 'verify' && (
            <form onSubmit={onVerify} className="space-y-4">
              <Field label="Username or email" htmlFor="rp-user">
                <input
                  id="rp-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  disabled={loading}
                  className={inputClass}
                />
              </Field>
              <Field label="Last 4 digits of phone" htmlFor="rp-phone">
                <input
                  id="rp-phone"
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  disabled={loading}
                  className={inputClass}
                />
              </Field>
              <Field label="Batch year (if on your profile)" htmlFor="rp-batch">
                <input
                  id="rp-batch"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  disabled={loading}
                  placeholder="e.g. 1995 — leave blank if unset"
                  className={inputClass}
                />
              </Field>
              {error && <Err>{error}</Err>}
              <button type="submit" disabled={loading} className={btnClass}>
                {loading ? 'Checking…' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'answers' && (
            <form onSubmit={onAnswers} className="space-y-4">
              <p className="text-body-sm text-on-surface-variant">Answer your recovery questions.</p>
              {questions.map((q) => (
                <Field key={q.id} label={q.label} htmlFor={`ans-${q.id}`}>
                  <input
                    id={`ans-${q.id}`}
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    required
                    minLength={2}
                    autoComplete="off"
                    disabled={loading}
                    className={inputClass}
                  />
                </Field>
              ))}
              {error && <Err>{error}</Err>}
              <button type="submit" disabled={loading} className={btnClass}>
                Continue
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={onPassword} className="space-y-4">
              <Field label="New password" htmlFor="rp-pw">
                <PasswordInput
                  id="rp-pw"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={loading}
                  className={inputClass}
                />
              </Field>
              <Field label="Confirm password" htmlFor="rp-pw2">
                <PasswordInput
                  id="rp-pw2"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={loading}
                  className={inputClass}
                />
              </Field>
              {error && <Err>{error}</Err>}
              <button type="submit" disabled={loading} className={btnClass}>
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <p className="p-3 rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm">
                Password updated. You can sign in now.
              </p>
              <Link href="/login" className={btnClass + ' inline-block text-center'}>
                Sign in
              </Link>
            </div>
          )}
        </div>

        <details className="mt-8 text-body-sm text-on-surface-variant">
          <summary className="cursor-pointer text-primary font-bold">Optional: email reset link</summary>
          <form onSubmit={onEmailLink} className="mt-4 space-y-3">
            <input
              type="email"
              value={emailHint || username}
              onChange={(e) => setEmailHint(e.target.value)}
              placeholder="Account email"
              className={inputClass}
              disabled={loading}
            />
            {emailMsg && (
              <p className="p-3 rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm">
                {emailMsg}
              </p>
            )}
            {devUrl && (
              <p className="break-all">
                Dev only —{' '}
                <Link href={devUrl} className="text-primary font-bold underline">
                  open link
                </Link>
              </p>
            )}
            <button type="submit" disabled={loading} className={btnClass}>
              {loading ? 'Sending…' : 'Send email link'}
            </button>
          </form>
        </details>

        <p className="mt-6 text-center text-body-sm text-on-surface-variant">
          Stuck? Ask the alumni committee for a temporary password.
        </p>
        <div className="text-center mt-4">
          <Link
            href="/login"
            className="text-label-sm text-primary hover:text-navy-subtle transition-colors uppercase tracking-wider"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:bg-surface-container';

const btnClass =
  'w-full py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle disabled:bg-surface-container disabled:text-on-surface-variant transition-all';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-label-md text-primary mb-2 uppercase tracking-wider" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Err({ children }: { children: ReactNode }) {
  return <div className="p-3 rounded-lg bg-error-container text-error text-body-sm">{children}</div>;
}
