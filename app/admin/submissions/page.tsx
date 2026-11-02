'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin-shell';

type Memory = {
  id: string;
  title: string;
  image_url: string | null;
  batch_year: number | null;
  batch_label: string | null;
  created_at: string;
  submitter_name: string | null;
};

type Story = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_name: string | null;
};

type Payload = {
  counts: { memories: number; stories: number };
  memories: Memory[];
  stories: Story[];
};

export default function AdminSubmissionsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setError('');
    const res = await fetch('/api/admin/approvals', { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || 'Could not load submissions');
      setData(null);
      return;
    }
    const full = payload as {
      counts: { memories: number; stories: number };
      memories: Memory[];
      stories: Story[];
    };
    setData({
      counts: { memories: full.counts.memories, stories: full.counts.stories },
      memories: full.memories || [],
      stories: full.stories || [],
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decideMemory(id: string, status: 'published' | 'rejected') {
    let review_note: string | undefined;
    if (status === 'rejected') {
      review_note = window.prompt('Optional note for the member:')?.trim() || undefined;
    }
    setBusy(id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/memories/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, review_note }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Update failed');
        return;
      }
      setMessage(status === 'published' ? 'Memory published.' : 'Memory rejected.');
      await load();
    } finally {
      setBusy('');
    }
  }

  async function decideStory(id: string, status: 'published' | 'rejected') {
    let review_note: string | undefined;
    if (status === 'rejected') {
      review_note = window.prompt('Optional note for the member:')?.trim() || undefined;
    }
    setBusy(id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/stories/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, review_note }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Update failed');
        return;
      }
      setMessage(status === 'published' ? 'Story published.' : 'Story rejected.');
      await load();
    } finally {
      setBusy('');
    }
  }

  const total = (data?.counts.memories || 0) + (data?.counts.stories || 0);

  return (
    <AdminShell title="Submissions">
      {error && (
        <p className="rounded-xl border border-error/30 bg-error-container p-4 text-body-sm text-error mb-4">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl border border-jubilee-gold-light bg-secondary-container/30 p-4 text-body-sm mb-4">
          {message}
        </p>
      )}

      <p className="text-body-sm text-on-surface-variant mb-6">
        Pending memories & stories:{' '}
        <span className="tabular-nums text-primary font-bold">{total}</span>
      </p>

      <section className="mb-8">
        <h2 className="text-headline-sm text-primary mb-3">
          Memories ({data?.counts.memories ?? 0})
        </h2>
        <ul className="space-y-3">
          {(data?.memories || []).length === 0 ? (
            <li className="text-body-sm text-on-surface-variant">No pending memories.</li>
          ) : (
            data!.memories.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-primary/10 bg-surface-paper p-4 flex flex-col gap-4"
              >
                <div className="flex gap-3 min-w-0">
                  {m.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt="" className="h-20 w-20 rounded-lg object-cover shrink-0" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{m.title}</p>
                    <p className="text-body-sm text-on-surface-variant mt-1">
                      {m.submitter_name || 'Member'}
                      {m.batch_label || m.batch_year != null
                        ? ` · ${m.batch_label || m.batch_year}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => void decideMemory(m.id, 'published')}
                    className="min-h-12 rounded-xl bg-primary text-on-primary px-4 py-3 text-label-sm disabled:opacity-50 cursor-pointer"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => void decideMemory(m.id, 'rejected')}
                    className="min-h-12 rounded-xl border border-error/30 text-error px-4 py-3 text-label-sm disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-headline-sm text-primary mb-3">Stories ({data?.counts.stories ?? 0})</h2>
        <ul className="space-y-3">
          {(data?.stories || []).length === 0 ? (
            <li className="text-body-sm text-on-surface-variant">No pending stories.</li>
          ) : (
            data!.stories.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border border-primary/10 bg-surface-paper p-4 flex flex-col gap-3"
              >
                <div>
                  <p className="font-medium text-primary">{s.title}</p>
                  <p className="text-body-sm text-on-surface-variant mt-1">{s.author_name || 'Member'}</p>
                  <p className="text-body-sm text-navy-subtle mt-2 whitespace-pre-wrap">{s.body}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => void decideStory(s.id, 'published')}
                    className="min-h-12 rounded-xl bg-primary text-on-primary px-4 py-3 text-label-sm disabled:opacity-50 cursor-pointer"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => void decideStory(s.id, 'rejected')}
                    className="min-h-12 rounded-xl border border-error/30 text-error px-4 py-3 text-label-sm disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </AdminShell>
  );
}
