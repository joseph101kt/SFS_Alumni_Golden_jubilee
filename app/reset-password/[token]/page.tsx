'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PasswordInput from '@/components/password-input';

export default function ResetPasswordConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password, confirm }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not reset password');
        return;
      }
      router.push('/member');
    } catch {
      setError('Could not reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              alt="SFS Shanthinagar Emblem"
              className="h-12 w-auto object-contain"
              src="/images/emblem.png"
            />
          </div>
          <h1 className="text-headline-lg text-primary mb-2">Choose a new password</h1>
          <p className="text-body-sm text-on-surface-variant">
            At least 8 characters. You will be signed in after saving.
          </p>
        </div>

        <div className="bg-surface-paper rounded-xl shadow-md p-8 border border-surface-container-low">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col">
              <label
                className="text-label-md text-primary mb-2 uppercase tracking-wider"
                htmlFor="new-password"
              >
                New password
              </label>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                disabled={loading}
                className="px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:bg-surface-container"
              />
            </div>
            <div className="flex flex-col">
              <label
                className="text-label-md text-primary mb-2 uppercase tracking-wider"
                htmlFor="confirm-password"
              >
                Confirm password
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                required
                disabled={loading}
                className="px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:bg-surface-container"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error-container text-error text-body-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle disabled:bg-surface-container disabled:text-on-surface-variant transition-all mt-2"
            >
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link
            href="/reset-password"
            className="text-label-sm text-primary hover:text-navy-subtle transition-colors uppercase tracking-wider"
          >
            Request a new link
          </Link>
        </div>
      </div>
    </div>
  );
}
