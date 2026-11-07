'use client';

import { FormEvent, useState } from 'react';
import AdminShell from '@/components/admin-shell';
import { formatCostForDisplay } from '@/lib/registration/registration';

type Hit = {
  registration_code: string;
  full_name: string;
  number_of_guests: number;
  meals?: string;
  event_title: string;
  payment_status: string;
  amount_due_paise: number;
};

export default function CheckInPage() {
  const [code, setCode] = useState('');
  const [hit, setHit] = useState<Hit | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setHit(null);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/check-in?code=${encodeURIComponent(code.trim())}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Could not look up that ID');
        return;
      }
      setHit(payload as Hit);
    } finally {
      setBusy(false);
    }
  }

  const paid = hit?.payment_status === 'paid' && hit.amount_due_paise === 0;

  return (
    <AdminShell title="Check-in">
      <p className="mb-4 text-body-sm text-on-surface-variant max-w-2xl">
        For phone camera scanning with the gate PIN, use{' '}
        <a href="/gate" className="text-primary underline-offset-2 hover:underline">
          /gate
        </a>
        . This page stays available for typed lookups.
      </p>
      <form onSubmit={lookup} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
        <label className="flex-1">
          <span className="block text-label-sm uppercase tracking-wider text-primary mb-2">
            Registration ID
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SFS-4K7M2"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
            className="w-full px-4 py-3.5 rounded-lg border border-primary/15 text-body-md tracking-[0.12em] bg-surface-ivory focus:outline-none focus:border-jubilee-gold-deep"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="sm:self-end rounded-lg bg-primary text-on-primary px-5 py-3 text-label-md uppercase tracking-wider disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {message && (
        <p role="alert" className="mt-5 rounded-xl border border-error/30 bg-error-container p-4 text-body-sm text-error max-w-2xl">
          {message}
        </p>
      )}

      {hit && (
        <div
          role="status"
          className="mt-5 max-w-2xl rounded-2xl border border-primary/10 bg-surface-paper p-6 shadow-sm"
        >
          <p
            className={`inline-flex px-2.5 py-1 rounded-md text-label-sm uppercase tracking-wider ${
              paid ? 'bg-primary text-secondary-container' : 'bg-jubilee-gold-light text-on-secondary-fixed-variant'
            }`}
          >
            {paid ? 'Paid' : 'Not paid'}
          </p>
          <h3 className="mt-4 text-headline-md text-primary">{hit.full_name}</h3>
          <p className="mt-1 text-body-md text-navy-subtle tracking-[0.14em]">{hit.registration_code}</p>
          <dl className="mt-4 space-y-2 text-body-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">People</dt>
              <dd className="text-primary tabular-nums">{hit.number_of_guests}</dd>
            </div>
            {hit.meals ? (
              <div className="flex justify-between gap-4">
                <dt className="text-on-surface-variant">Meals</dt>
                <dd className="text-primary text-right">{hit.meals}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Event</dt>
              <dd className="text-primary text-right">{hit.event_title}</dd>
            </div>
            {!paid && (
              <div className="flex justify-between gap-4">
                <dt className="text-on-surface-variant">Still due</dt>
                <dd className="text-jubilee-gold-deep tabular-nums">{formatCostForDisplay(hit.amount_due_paise)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </AdminShell>
  );
}
