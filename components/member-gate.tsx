'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

type Me = {
  id: string;
  email: string;
  role: string;
  member_status: string;
};

export default function MemberGate({
  mode = 'verified',
  children,
}: {
  mode?: 'verified' | 'admin';
  children: ReactNode;
}) {
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!active) return;
        if (res.status === 401) {
          setState('signed-out');
          return;
        }
        if (!res.ok) {
          setState('setup');
          return;
        }
        const data = (await res.json()) as Me;
        if (mode === 'admin') {
          setState(
            data.role === 'admin' && data.member_status === 'verified' ? 'allowed' : 'forbidden'
          );
        } else if (data.member_status === 'verified') {
          setState('allowed');
        } else if (data.member_status === 'rejected' || data.member_status === 'suspended') {
          setState('rejected');
        } else {
          setState('pending');
        }
      } catch {
        if (active) setState('setup');
      }
    })();
    return () => {
      active = false;
    };
  }, [mode]);

  if (state === 'allowed') return <>{children}</>;

  const title =
    state === 'loading'
      ? 'Checking membership…'
      : state === 'signed-out'
        ? 'Sign in to continue'
        : state === 'pending'
          ? 'Membership awaiting verification'
          : state === 'rejected'
            ? 'Membership needs committee review'
            : state === 'forbidden'
              ? 'Committee access only'
              : 'Portal setup required';

  const body =
    state === 'loading'
      ? 'One moment.'
      : state === 'signed-out'
        ? 'Sign in or create an account to request access.'
        : state === 'pending'
          ? 'Your account exists, but the alumni committee must verify your connection to SFS before private directory access is enabled.'
          : state === 'rejected'
            ? 'Your membership is not currently active. Please contact the alumni committee.'
            : state === 'forbidden'
              ? 'This workspace is restricted to authorised, verified committee administrators.'
              : 'The alumni database is not fully configured. Apply the alumni_accounts migration and set AUTH_SECRET plus SUPABASE_SERVICE_ROLE_KEY.';

  return (
    <section className="max-w-3xl rounded-2xl border border-outline-variant bg-white p-8">
      <h2 className="text-headline-sm text-primary">{title}</h2>
      <p className="text-body-sm text-on-surface-variant mt-3">{body}</p>
      {state === 'signed-out' && (
        <div className="flex gap-3 mt-5">
          <Link className="px-5 py-3 rounded-lg bg-primary text-white" href="/login">
            Sign in
          </Link>
          <Link className="px-5 py-3 rounded-lg bg-secondary-container text-primary" href="/signup">
            Create account
          </Link>
        </div>
      )}
    </section>
  );
}
