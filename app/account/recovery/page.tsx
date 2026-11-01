'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import MemberGate from '@/components/member-gate';
import PortalShell from '@/components/portal-shell';

type Q = { id: string; label: string };

export default function RecoveryQuestionsPage() {
  const [bank, setBank] = useState<Q[]>([]);
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [a1, setA1] = useState('');
  const [a2, setA2] = useState('');
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/recovery-questions', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(payload.error || 'Could not load');
          return;
        }
        setBank(Array.isArray(payload.questions) ? payload.questions : []);
        setConfigured(Boolean(payload.configured));
        const selected = Array.isArray(payload.selected) ? payload.selected : [];
        if (selected[0]) setQ1(String(selected[0]));
        if (selected[1]) setQ2(String(selected[1]));
      } catch {
        if (active) setError('Could not load');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/auth/recovery-questions', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q1, q2, a1, a2 }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not save');
        return;
      }
      setConfigured(true);
      setA1('');
      setA2('');
      setOk('Recovery questions saved. You can use them on Forgot password.');
    } catch {
      setError('Could not save');
    } finally {
      setBusy(false);
    }
  }

  const q2Options = bank.filter((q) => q.id !== q1);
  const q1Options = bank.filter((q) => q.id !== q2);

  return (
    <PortalShell
      title="Recovery questions"
      intro="Pick two questions and answers. You’ll need them plus the last 4 digits of your phone to reset a forgotten password."
    >
      <MemberGate>
        {loading ? (
          <p className="text-body-sm text-on-surface-variant">Loading…</p>
        ) : (
          <form
            onSubmit={onSubmit}
            className="max-w-xl rounded-2xl border border-outline-variant bg-surface-paper p-6 space-y-4"
          >
            {configured && (
              <p className="text-body-sm text-on-surface-variant">
                Questions are already set. Saving again replaces them (re-enter both answers).
              </p>
            )}

            <div>
              <label className="text-label-md text-primary mb-2 uppercase tracking-wider block" htmlFor="rq1">
                Question 1
              </label>
              <select
                id="rq1"
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
                required
                disabled={busy}
                className="w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface"
              >
                <option value="">Select…</option>
                {q1Options.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={a1}
                onChange={(e) => setA1(e.target.value)}
                required
                minLength={2}
                disabled={busy}
                placeholder="Your answer"
                autoComplete="off"
                className="mt-2 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface"
              />
            </div>

            <div>
              <label className="text-label-md text-primary mb-2 uppercase tracking-wider block" htmlFor="rq2">
                Question 2
              </label>
              <select
                id="rq2"
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
                required
                disabled={busy}
                className="w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface"
              >
                <option value="">Select…</option>
                {q2Options.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={a2}
                onChange={(e) => setA2(e.target.value)}
                required
                minLength={2}
                disabled={busy}
                placeholder="Your answer"
                autoComplete="off"
                className="mt-2 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface"
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
              disabled={busy || !q1 || !q2}
              className="w-full py-3 rounded-lg bg-primary text-on-primary text-label-md font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save questions'}
            </button>
          </form>
        )}
        <p className="mt-4 text-body-sm text-on-surface-variant">
          Answers are stored securely (hashed). Spelling must match when you reset later.
        </p>
        <Link href="/member" className="inline-block mt-3 text-primary font-bold underline underline-offset-2">
          Back to home
        </Link>
      </MemberGate>
    </PortalShell>
  );
}
