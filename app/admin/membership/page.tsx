'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin-shell';

type MemberStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

type Person = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  batch: number | null;
  role: 'alumni' | 'admin';
  member_status: MemberStatus;
  created_at: string;
  reviewed_at?: string | null;
};

type Me = { id: string };
type Tab = 'pending' | 'directory';

const FILTERS: { key: '' | MemberStatus; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

export default function AdminMembershipPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [meId, setMeId] = useState('');
  const [pending, setPending] = useState<Person[]>([]);
  const [members, setMembers] = useState<Person[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | MemberStatus>('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadPending = useCallback(async () => {
    const res = await fetch('/api/admin/pending');
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setMessage(payload.error || 'Could not load pending queue.');
      setPending([]);
      return;
    }
    setPending((await res.json()) as Person[]);
  }, []);

  const loadMembers = useCallback(async (search: string, filter: '' | MemberStatus) => {
    setLoadingMembers(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/admin/members?${params}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setMessage(payload.error || 'Could not load members.');
        setMembers([]);
        return;
      }
      setMembers((await res.json()) as Person[]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const me = (await meRes.json()) as Me;
        setMeId(me.id);
      }
      await loadPending();
      await loadMembers('', '');
    })().catch(() => setMessage('Admin portal is not configured yet.'));
  }, [loadPending, loadMembers]);

  useEffect(() => {
    if (tab !== 'directory') return;
    const t = setTimeout(() => {
      void loadMembers(q, status);
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, loadMembers, tab]);

  async function decide(id: string, next: MemberStatus) {
    setBusy(id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/decide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Could not update membership.');
        return;
      }
      setMessage(`Membership set to ${next}.`);
      await loadPending();
      await loadMembers(q, status);
    } finally {
      setBusy('');
    }
  }

  async function setRole(id: string, role: 'admin' | 'alumni') {
    setBusy(id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, role }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Could not update role.');
        return;
      }
      setMessage(role === 'admin' ? 'Member promoted to admin.' : 'Admin role removed.');
      await loadMembers(q, status);
    } finally {
      setBusy('');
    }
  }

  async function resetPassword(p: Person) {
    if (p.batch == null) {
      setMessage(`Add a batch year for ${p.full_name} before resetting the password.`);
      return;
    }
    if (
      !window.confirm(
        `Reset password for ${p.full_name} to username_${p.batch}? Share it offline (phone/WhatsApp).`
      )
    ) {
      return;
    }
    setBusy(p.id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/members/${p.id}/password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Could not set password.');
        return;
      }
      const temp = String(payload.temporaryPassword || '');
      setMessage(
        `Password for ${p.full_name}: ${temp} — copied if possible. Share offline; they can change it after login.`
      );
      if (temp && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(temp).catch(() => undefined);
      }
    } finally {
      setBusy('');
    }
  }

  function statusBadge(s: MemberStatus) {
    const styles: Record<MemberStatus, string> = {
      pending: 'bg-secondary-container text-on-secondary-fixed',
      verified: 'bg-primary text-white',
      rejected: 'bg-error-container text-error',
      suspended: 'bg-surface-container-high text-on-surface-variant',
    };
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-md text-label-sm capitalize ${styles[s]}`}>
        {s}
      </span>
    );
  }

  function actionsFor(p: Person, mode: Tab) {
    if (p.id === meId) {
      return <span className="text-label-sm text-on-surface-variant">You</span>;
    }
    const disabled = busy === p.id;
    const btn =
      'rounded-lg px-3 py-2 text-label-sm disabled:opacity-50 border border-primary/20 bg-surface-ivory text-primary cursor-pointer hover:bg-secondary-container/30';
    const primary =
      'rounded-lg px-3 py-2 text-label-sm disabled:opacity-50 bg-primary text-on-primary cursor-pointer hover:bg-primary-container';

    if (mode === 'pending' || p.member_status === 'pending') {
      return (
        <div className="flex flex-wrap gap-2 justify-end">
          <button disabled={disabled} className={primary} onClick={() => decide(p.id, 'verified')}>
            Approve
          </button>
          <button disabled={disabled} className={btn} onClick={() => decide(p.id, 'rejected')}>
            Reject
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 justify-end">
        <button disabled={disabled} className={btn} onClick={() => void resetPassword(p)}>
          Reset password
        </button>
        {p.member_status === 'verified' && (
          <>
            <button disabled={disabled} className={btn} onClick={() => decide(p.id, 'suspended')}>
              Suspend
            </button>
            {p.role === 'alumni' ? (
              <button disabled={disabled} className={primary} onClick={() => setRole(p.id, 'admin')}>
                Make admin
              </button>
            ) : (
              <button disabled={disabled} className={btn} onClick={() => setRole(p.id, 'alumni')}>
                Remove admin
              </button>
            )}
          </>
        )}
        {(p.member_status === 'rejected' || p.member_status === 'suspended') && (
          <>
            <button disabled={disabled} className={primary} onClick={() => decide(p.id, 'verified')}>
              Re-verify
            </button>
            <button disabled={disabled} className={btn} onClick={() => decide(p.id, 'pending')}>
              Re-open
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <AdminShell title="Membership">
      {message && (
        <p
          role="status"
          className="rounded-xl bg-secondary-container/30 border border-jubilee-gold-light p-4 text-body-sm text-on-secondary-fixed-variant mb-4"
        >
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {(
          [
            ['pending', 'Pending'],
            ['directory', 'Directory'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-full text-label-sm cursor-pointer transition-colors ${
              tab === key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-paper text-navy-subtle border border-primary/10 hover:bg-secondary-container/30'
            }`}
          >
            {label}
            {key === 'pending' && pending.length > 0 ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <section className="rounded-2xl border border-jubilee-gold-light bg-surface-paper p-5 shadow-sm">
          <div className="mb-4 rounded-xl bg-gradient-to-r from-secondary-container/70 to-jubilee-gold-light/40 px-4 py-3 border border-jubilee-gold-deep/15">
            <p className="text-label-md text-jubilee-gold-deep font-bold">
              {pending.length} awaiting approval
            </p>
            <p className="text-body-sm text-on-secondary-fixed-variant mt-1">
              Verify applicants against school or alumni records before granting directory access.
            </p>
          </div>
          {pending.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">
              No one waiting — you’re clear.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-jubilee-gold-light/70 bg-surface-ivory p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between"
                >
                  <div>
                    <h3 className="text-headline-sm text-primary">{p.full_name}</h3>
                    <p className="text-body-sm text-on-surface-variant">
                      {p.email}
                      {p.phone_number ? ` · ${p.phone_number}` : ''}
                    </p>
                    <p className="text-label-sm text-on-surface-variant mt-1">
                      {p.batch ? `Batch ${p.batch}` : 'Batch not provided'} · Requested{' '}
                      {new Date(p.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  {actionsFor({ ...p, role: p.role || 'alumni', member_status: 'pending' }, 'pending')}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'directory' && (
        <section className="rounded-2xl bg-surface-paper border border-primary/10 p-5 shadow-sm">
          <div className="flex flex-col gap-4 mb-5">
            <div>
              <h3 className="text-headline-sm text-primary">Directory</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Search accounts, filter by status, suspend, re-open, or promote verified members.
              </p>
            </div>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, or phone…"
              className="w-full px-4 py-3.5 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory focus:outline-none focus:border-jubilee-gold-deep focus:ring-2 focus:ring-secondary-container/50"
            />
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setStatus(f.key)}
                  className={`px-3 py-2 rounded-full text-label-sm transition-colors cursor-pointer ${
                    status === f.key
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-ivory text-navy-subtle border border-primary/10 hover:bg-secondary-container/30'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingMembers ? (
            <p className="text-body-sm text-on-surface-variant">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No members match these filters.</p>
          ) : (
            <div className="space-y-3">
              {members.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-primary/10 bg-surface-ivory p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-headline-sm text-primary">{p.full_name}</h3>
                      {statusBadge(p.member_status)}
                      {p.role === 'admin' && (
                        <span className="inline-flex px-2.5 py-1 rounded-md text-label-sm bg-secondary-container text-on-secondary-fixed">
                          admin
                        </span>
                      )}
                    </div>
                    <p className="text-body-sm text-on-surface-variant">
                      {p.email}
                      {p.phone_number ? ` · ${p.phone_number}` : ''}
                    </p>
                    <p className="text-label-sm text-on-surface-variant mt-1">
                      {p.batch ? `Batch ${p.batch}` : 'Batch not provided'} · Joined{' '}
                      {new Date(p.created_at).toLocaleDateString('en-IN')}
                      {p.reviewed_at
                        ? ` · Reviewed ${new Date(p.reviewed_at).toLocaleDateString('en-IN')}`
                        : ''}
                    </p>
                  </div>
                  {actionsFor(p, 'directory')}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </AdminShell>
  );
}
