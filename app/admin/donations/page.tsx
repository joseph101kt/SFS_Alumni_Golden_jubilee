'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin-shell';

type Cause = {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  sort_order: number;
};

type DonationRow = {
  id: string;
  amount_paise: number;
  message: string | null;
  payment_status: string;
  razorpay_payment_id: string | null;
  created_at: string;
  cause_title: string;
  donor_name: string;
  donor_email: string;
};

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function AdminDonationsPage() {
  const [causes, setCauses] = useState<Cause[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    sort_order: '0',
    active: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadCauses = useCallback(async () => {
    const res = await fetch('/api/admin/donation-causes', { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Could not load causes');
    setCauses(payload.causes || []);
  }, []);

  const loadDonations = useCallback(async () => {
    const q = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    const res = await fetch(`/api/admin/donations${q}`, { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Could not load donations');
    setDonations(payload.donations || []);
  }, [statusFilter]);

  const load = useCallback(async () => {
    setError('');
    try {
      await Promise.all([loadCauses(), loadDonations()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [loadCauses, loadDonations]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(c: Cause) {
    setEditingId(c.id);
    setForm({
      title: c.title,
      description: c.description || '',
      sort_order: String(c.sort_order),
      active: c.active,
    });
    setOk('');
    setError('');
  }

  function startCreate() {
    setEditingId(null);
    setForm({ title: '', description: '', sort_order: '0', active: true });
  }

  async function onSaveCause(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const body = {
        title: form.title,
        description: form.description,
        sort_order: Number(form.sort_order) || 0,
        active: form.active,
      };
      const url = editingId
        ? `/api/admin/donation-causes/${editingId}`
        : '/api/admin/donation-causes';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Save failed');
        return;
      }
      setOk(editingId ? 'Donation type updated.' : 'Donation type added.');
      startCreate();
      await loadCauses();
    } catch {
      setError('Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Donations">
      <p className="text-body-sm text-on-surface-variant mb-6 max-w-3xl">
        Set up <strong>donation types</strong> (what members can give to), then track gifts that
        come in through Razorpay.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4 h-fit">
          <div>
            <h3 className="text-headline-sm text-primary">Donation types</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Add each fund or purpose here. Active types show on{' '}
              <code className="text-label-sm">/member/donate</code>. Turn Active off to hide one
              without deleting history.
            </p>
          </div>

          <form onSubmit={onSaveCause} className="space-y-3">
            <h4 className="text-label-md text-primary uppercase tracking-wider">
              {editingId ? 'Edit type' : 'Add type'}
            </h4>
            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">Name</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                disabled={busy}
                placeholder="e.g. Scholarship fund"
                className="mt-1 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm"
              />
            </label>
            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                Short description
              </span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                disabled={busy}
                placeholder="Shown under the name when alumni choose where to give"
                className="mt-1 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm resize-y"
              />
            </label>
            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                Display order
              </span>
              <input
                inputMode="numeric"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                disabled={busy}
                className="mt-1 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm"
              />
              <span className="text-body-sm text-on-surface-variant">Lower numbers appear first.</span>
            </label>
            <label className="flex items-center gap-2 text-body-sm text-primary font-medium">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                disabled={busy}
              />
              Active (members can select this type)
            </label>
            {error ? (
              <p className="rounded-lg bg-error-container text-error text-body-sm p-3">{error}</p>
            ) : null}
            {ok ? (
              <p className="rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm p-3">
                {ok}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary text-on-primary px-4 py-2.5 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {busy ? 'Saving…' : editingId ? 'Save type' : 'Add type'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={startCreate}
                  className="rounded-lg border border-outline-variant px-4 py-2.5 text-label-sm uppercase tracking-wider"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <ul className="pt-4 space-y-2 border-t border-outline-variant">
            <li className="text-label-sm uppercase tracking-wider text-on-surface-variant pb-1">
              Current types ({causes.length})
            </li>
            {!causes.length ? (
              <li className="text-body-sm text-on-surface-variant py-2">
                No types yet — add the first one above.
              </li>
            ) : null}
            {causes.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 text-body-sm py-2"
              >
                <div>
                  <p className="font-semibold text-primary">
                    {c.title}
                    {!c.active ? (
                      <span className="ml-2 text-on-surface-variant font-normal">· inactive</span>
                    ) : null}
                  </p>
                  {c.description ? (
                    <p className="text-on-surface-variant line-clamp-2">{c.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="text-primary underline underline-offset-2 shrink-0"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-headline-sm text-primary">Received gifts ({donations.length})</h3>
            <div className="flex gap-1">
              {(['all', 'paid', 'pending', 'failed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1.5 text-label-sm capitalize ${
                    statusFilter === s
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {!donations.length ? (
            <p className="text-body-sm text-on-surface-variant">No donations yet.</p>
          ) : (
            <ul className="space-y-3">
              {donations.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-outline-variant bg-white p-4 text-body-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-semibold text-primary">
                      {formatInr(d.amount_paise)} · {d.cause_title}
                    </p>
                    <span className="text-label-sm uppercase tracking-wider text-jubilee-gold-deep">
                      {d.payment_status}
                    </span>
                  </div>
                  <p className="text-on-surface-variant mt-1">
                    {d.donor_name} · {d.donor_email}
                  </p>
                  {d.message ? <p className="mt-1 text-on-surface">{d.message}</p> : null}
                  <p className="text-on-surface-variant mt-2 text-label-sm">
                    {new Date(d.created_at).toLocaleString('en-IN')}
                    {d.razorpay_payment_id ? ` · ${d.razorpay_payment_id}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
