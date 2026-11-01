'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import MemberGate from '@/components/member-gate';
import PasswordInput from '@/components/password-input';
import PortalShell from '@/components/portal-shell';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, password, confirm }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not change password');
        return;
      }
      setOk('Password updated.');
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
    } catch {
      setError('Could not change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell
      title="Change password"
      intro="Update your password while signed in. No email required."
    >
      <MemberGate>
        <form
          onSubmit={onSubmit}
          className="max-w-lg rounded-2xl border border-outline-variant bg-surface-paper p-6 space-y-4"
        >
          <div>
            <label className="text-label-md text-primary mb-2 uppercase tracking-wider block" htmlFor="cur">
              Current password
            </label>
            <PasswordInput
              id="cur"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              required
              disabled={busy}
              className="px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="text-label-md text-primary mb-2 uppercase tracking-wider block" htmlFor="npw">
              New password
            </label>
            <PasswordInput
              id="npw"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
              minLength={8}
              disabled={busy}
              className="px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="text-label-md text-primary mb-2 uppercase tracking-wider block" htmlFor="cpw">
              Confirm new password
            </label>
            <PasswordInput
              id="cpw"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              required
              minLength={8}
              disabled={busy}
              className="px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {error && (
            <p className="p-3 rounded-lg bg-error-container text-error text-body-sm">{error}</p>
          )}
          {ok && (
            <p className="p-3 rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm">
              {ok}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg bg-primary text-on-primary text-label-md font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
        <p className="mt-4 text-body-sm text-on-surface-variant">
          Forgot your current password? Use{' '}
          <Link href="/reset-password" className="text-primary font-bold underline underline-offset-2">
            Forgot password
          </Link>{' '}
          (phone + recovery questions), or ask the committee. Set questions under{' '}
          <Link href="/account/recovery" className="text-primary font-bold underline underline-offset-2">
            Recovery questions
          </Link>
          .
        </p>
        <Link href="/member" className="inline-block mt-3 text-primary font-bold underline underline-offset-2">
          Back to home
        </Link>
      </MemberGate>
    </PortalShell>
  );
}
