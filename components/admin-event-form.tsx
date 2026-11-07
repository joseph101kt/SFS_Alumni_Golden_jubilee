// components/admin/admin-event-form.tsx
// Create or edit an event. The fee is fixed at the flat per-person rate in
// lib/registration/registration, so this form no longer takes pricing inputs.

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { EVENT_FEE_PER_PERSON_PAISE, formatCostForDisplay } from '@/lib/registration/registration';
import type { EventCatalog } from '@/lib/events/types';

type FormState = {
  title: string;
  summary: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  published: boolean;
  is_primary: boolean;
  refund_email: string;
};

type SaveEventResponse = {
  error?: string;
  warning?: string;
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  if (!local) return '';
  return new Date(local).toISOString();
}

function initialFrom(event?: EventCatalog | null): FormState {
  return {
    title: event?.title || '',
    summary: event?.summary || '',
    description: event?.description || '',
    starts_at: toLocalInput(event?.starts_at),
    ends_at: toLocalInput(event?.ends_at),
    venue: event?.venue || '',
    published: event?.published ?? false,
    is_primary: event?.is_primary ?? false,
    refund_email: event?.refund_email || '',
  };
}

const FIELD_CLASS =
  'w-full px-4 py-3.5 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory focus:outline-none focus:border-jubilee-gold-deep focus:ring-2 focus:ring-secondary-container/40';
const LABEL_CLASS = 'block text-label-sm text-navy-subtle mb-1.5 font-medium';

export default function AdminEventForm({ event }: { event?: EventCatalog | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialFrom(event));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      description: form.description.trim() || null,
      starts_at: fromLocalInput(form.starts_at),
      ends_at: form.ends_at ? fromLocalInput(form.ends_at) : null,
      venue: form.venue.trim() || null,
      published: form.published,
      is_primary: form.is_primary,
      refund_email: form.refund_email.trim() || null,
    };

    try {
      const res = await fetch(event ? `/api/admin/events/${event.id}` : '/api/admin/events', {
        method: event ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as SaveEventResponse;
      if (!res.ok) {
        setError(body.error || 'Could not save event');
        return;
      }
      if (body.warning) {
        setError(body.warning);
        return;
      }
      router.push('/admin/events');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-primary/10 bg-surface-paper p-5 space-y-4 shadow-sm">
          <h3 className="text-headline-sm text-primary">Details</h3>
          <div>
            <label className={LABEL_CLASS} htmlFor="title">Title</label>
            <input
              id="title"
              className={FIELD_CLASS}
              required
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="summary">Summary</label>
            <textarea
              id="summary"
              className={FIELD_CLASS}
              required
              rows={2}
              value={form.summary}
              onChange={(e) => setField('summary', e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              className={FIELD_CLASS}
              rows={4}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS} htmlFor="starts_at">Starts</label>
              <input
                id="starts_at"
                type="datetime-local"
                className={FIELD_CLASS}
                required
                value={form.starts_at}
                onChange={(e) => setField('starts_at', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="ends_at">Ends (optional)</label>
              <input
                id="ends_at"
                type="datetime-local"
                className={FIELD_CLASS}
                value={form.ends_at}
                onChange={(e) => setField('ends_at', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="venue">Venue</label>
            <input
              id="venue"
              className={FIELD_CLASS}
              value={form.venue}
              onChange={(e) => setField('venue', e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="refund_email">Committee refund email</label>
            <input
              id="refund_email"
              type="email"
              className={FIELD_CLASS}
              placeholder="committee@example.org"
              value={form.refund_email}
              onChange={(e) => setField('refund_email', e.target.value)}
            />
            <p className="text-label-sm text-on-surface-variant mt-1.5">
              Required for the clickable refund link on registration. Overpayments still show a credit notice
              even if this is blank. Set an email so alumni can mail the committee.
            </p>
          </div>
          <label className="flex items-center gap-2 text-body-sm text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setField('published', e.target.checked)}
            />
            Published (visible on Alumni Events and open for registration)
          </label>
          <label className="flex items-center gap-2 text-body-sm text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={(e) => setField('is_primary', e.target.checked)}
            />
            Primary event (drives site Register CTAs)
          </label>
        </section>

        {error && <p className="text-body-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary text-on-primary px-5 py-3 text-label-md uppercase tracking-wider disabled:opacity-50 cursor-pointer hover:bg-primary-container"
        >
          {busy ? 'Saving…' : event ? 'Save event' : 'Create event'}
        </button>
      </div>

      <aside className="rounded-2xl border border-jubilee-gold-deep/20 bg-primary text-on-primary p-5 h-fit lg:sticky lg:top-28 shadow-md">
        <div className="text-label-sm uppercase tracking-widest text-secondary-container font-bold">Event fee</div>
        <div className="text-headline-md text-secondary-container mt-3">
          {formatCostForDisplay(EVENT_FEE_PER_PERSON_PAISE)}
        </div>
        <p className="text-label-sm text-primary-fixed-dim mt-2">
          Per person. Applies to guests, and to the alumnus when attending and having lunch (batches 2021–26
          excluded). Set in code, not per event.
        </p>
      </aside>
    </form>
  );
}