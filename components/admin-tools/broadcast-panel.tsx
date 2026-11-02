'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Broadcast = {
  id: string;
  title: string;
  body: string;
  deep_link: string | null;
  created_at: string;
  sent_count: number;
};

export default function BroadcastPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deepLink, setDeepLink] = useState('/event-app');
  const [rows, setRows] = useState<Broadcast[]>([]);
  const [vapid, setVapid] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/broadcast', { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) {
      setRows(payload.broadcasts || []);
      setVapid(payload.vapid !== false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, deep_link: deepLink }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Send failed');
        return;
      }
      setMessage(`Sent to ${payload.sent} device(s).`);
      setTitle('');
      setBody('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!vapid && (
        <p className="mb-4 rounded-xl border border-error/30 bg-error-container p-4 text-body-sm text-error">
          Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and optionally `VAPID_SUBJECT` before
          sending. Generate with `npx web-push generate-vapid-keys`.
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-xl border border-jubilee-gold-light bg-secondary-container/30 p-4 text-body-sm">
          {message}
        </p>
      )}

      <form onSubmit={onSubmit} className="max-w-xl space-y-4 mb-10">
        <label className="block">
          <span className="text-label-sm uppercase tracking-wider text-primary">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            className="mt-2 w-full px-4 py-3.5 rounded-lg border border-primary/15 bg-surface-ivory"
          />
        </label>
        <label className="block">
          <span className="text-label-sm uppercase tracking-wider text-primary">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={280}
            rows={4}
            className="mt-2 w-full px-4 py-3.5 rounded-lg border border-primary/15 bg-surface-ivory"
          />
        </label>
        <label className="block">
          <span className="text-label-sm uppercase tracking-wider text-primary">Open link</span>
          <select
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
            className="mt-2 w-full px-4 py-3.5 rounded-lg border border-primary/15 bg-surface-ivory"
          >
            <option value="/event-app">Event app home</option>
            <option value="/event-app/day">Day-of details</option>
            <option value="/member">Venue pass / member home</option>
            <option value="/gate">Gate scanner</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy || !vapid}
          className="rounded-lg bg-primary text-on-primary px-5 py-3 text-label-md disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Sending…' : 'Send to installed apps'}
        </button>
      </form>

      <h2 className="text-headline-sm text-primary mb-3">Recent broadcasts</h2>
      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li className="text-body-sm text-on-surface-variant">None yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-primary/10 bg-surface-paper p-4">
              <p className="font-medium text-primary">{r.title}</p>
              <p className="text-body-sm text-on-surface-variant mt-1 whitespace-pre-wrap">{r.body}</p>
              <p className="text-label-sm text-navy-subtle mt-2">
                {new Date(r.created_at).toLocaleString('en-IN')} · sent {r.sent_count}
                {r.deep_link ? ` · ${r.deep_link}` : ''}
              </p>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
