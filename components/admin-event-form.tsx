'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  formatCostForDisplay,
  getEventCostBreakdown,
  type EventPricing,
} from '@/lib/registration';
import type { EventCatalog } from '@/lib/events/types';
import { BATCH_START_YEAR } from '@/lib/registration-fields';

type FormState = {
  title: string;
  summary: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  published: boolean;
  is_primary: boolean;
  lunch_rupees: string;
  lunch_nonveg_rupees: string;
  dinner_rupees: string;
  dinner_nonveg_rupees: string;
  parking_2w_rupees: string;
  parking_4w_rupees: string;
  base_ticket_rupees: string;
  fee_batch_from: string;
  fee_batch_to: string;
  fee_batch_rupees: string;
  refund_email: string;
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string) {
  if (!local) return '';
  return new Date(local).toISOString();
}

function paiseToRupeesField(paise: number) {
  return String((paise || 0) / 100);
}

function initialFrom(event?: EventCatalog | null): FormState {
  return {
    title: event?.title || '',
    summary: event?.summary || '',
    description: event?.description || '',
    starts_at: toLocalInput(event?.starts_at) || '',
    ends_at: toLocalInput(event?.ends_at),
    venue: event?.venue || '',
    published: event?.published ?? false,
    is_primary: event?.is_primary ?? false,
    lunch_rupees: paiseToRupeesField(event?.lunch_paise ?? 30000),
    lunch_nonveg_rupees: paiseToRupeesField(event?.lunch_nonveg_paise ?? event?.lunch_paise ?? 30000),
    dinner_rupees: paiseToRupeesField(event?.dinner_paise ?? 50000),
    dinner_nonveg_rupees: paiseToRupeesField(event?.dinner_nonveg_paise ?? event?.dinner_paise ?? 50000),
    parking_2w_rupees: paiseToRupeesField(event?.parking_2w_paise ?? 5000),
    parking_4w_rupees: paiseToRupeesField(event?.parking_4w_paise ?? 20000),
    base_ticket_rupees: paiseToRupeesField(event?.base_ticket_paise ?? 0),
    fee_batch_from: event?.fee_batch_from != null ? String(event.fee_batch_from) : '',
    fee_batch_to: event?.fee_batch_to != null ? String(event.fee_batch_to) : '',
    fee_batch_rupees: paiseToRupeesField(event?.fee_batch_paise ?? 0),
    refund_email: event?.refund_email || '',
  };
}

function optionalYear(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1900) return null;
  return n;
}

function pricingFromForm(f: FormState): EventPricing {
  const r = (s: string) => Math.round((Number(s) || 0) * 100);
  return {
    lunch_paise: r(f.lunch_rupees),
    lunch_nonveg_paise: r(f.lunch_nonveg_rupees),
    dinner_paise: r(f.dinner_rupees),
    dinner_nonveg_paise: r(f.dinner_nonveg_rupees),
    parking_2w_paise: r(f.parking_2w_rupees),
    parking_4w_paise: r(f.parking_4w_rupees),
    base_ticket_paise: r(f.base_ticket_rupees),
    fee_batch_from: optionalYear(f.fee_batch_from),
    fee_batch_to: optionalYear(f.fee_batch_to),
    fee_batch_paise: r(f.fee_batch_rupees),
  };
}

export default function AdminEventForm({ event }: { event?: EventCatalog | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialFrom(event));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const pricing = pricingFromForm(form);
    const sample = { numberOfGuests: 1, lunch: true, dinner: true, parkingNeeded: '4-wheeler' as const };
    const inRangeBatch =
      optionalYear(form.fee_batch_from) ?? optionalYear(form.fee_batch_to) ?? BATCH_START_YEAR;
    const outRangeBatch = (optionalYear(form.fee_batch_to) ?? 2099) + 1;
    return {
      vegIn: getEventCostBreakdown(pricing, {
        ...sample,
        foodPreference: 'veg',
        batch: inRangeBatch,
      }),
      vegOut: getEventCostBreakdown(pricing, {
        ...sample,
        foodPreference: 'veg',
        batch: outRangeBatch,
      }),
      nonveg: getEventCostBreakdown(pricing, {
        ...sample,
        foodPreference: 'non-veg',
        batch: inRangeBatch,
      }),
    };
  }, [form]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const pricing = pricingFromForm(form);
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
      ...pricing,
    };

    try {
      const res = await fetch(event ? `/api/admin/events/${event.id}` : '/api/admin/events', {
        method: event ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
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

  const field =
    'w-full px-4 py-3 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory focus:outline-none focus:border-jubilee-gold-deep focus:ring-2 focus:ring-secondary-container/40';
  const label = 'block text-label-sm text-navy-subtle mb-1.5 font-medium';

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-primary/10 bg-surface-paper p-5 space-y-4 shadow-sm">
          <h3 className="text-headline-sm text-primary">Details</h3>
          <div>
            <label className={label}>Title</label>
            <input
              className={field}
              required
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Summary</label>
            <textarea
              className={field}
              required
              rows={2}
              value={form.summary}
              onChange={(e) => setField('summary', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Description (optional)</label>
            <textarea
              className={field}
              rows={4}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Starts</label>
              <input
                type="datetime-local"
                className={field}
                required
                value={form.starts_at}
                onChange={(e) => setField('starts_at', e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Ends (optional)</label>
              <input
                type="datetime-local"
                className={field}
                value={form.ends_at}
                onChange={(e) => setField('ends_at', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={label}>Venue</label>
            <input
              className={field}
              value={form.venue}
              onChange={(e) => setField('venue', e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="refund_email">
              Committee refund email
            </label>
            <input
              id="refund_email"
              type="email"
              className={field}
              placeholder="committee@example.org"
              value={form.refund_email}
              onChange={(e) => setField('refund_email', e.target.value)}
            />
            <p className="text-label-sm text-on-surface-variant mt-1.5">
              Required for the clickable refund link on registration. Overpayments still show a
              credit notice even if this is blank — set an email so alumni can mailto the
              committee.
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

        <section className="rounded-2xl border border-jubilee-gold-light bg-gradient-to-br from-secondary-container/25 to-surface-paper p-5 space-y-4 shadow-sm">
          <h3 className="text-headline-sm text-primary">Pricing (₹)</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {(
              [
                ['lunch_rupees', 'Lunch · veg / person'],
                ['lunch_nonveg_rupees', 'Lunch · non-veg / person'],
                ['dinner_rupees', 'Dinner · veg / person'],
                ['dinner_nonveg_rupees', 'Dinner · non-veg / person'],
                ['parking_2w_rupees', '2-wheeler parking'],
                ['parking_4w_rupees', '4-wheeler parking'],
                ['base_ticket_rupees', 'Registration fee / person (default)'],
              ] as const
            ).map(([key, lab]) => (
              <div key={key}>
                <label className={label} htmlFor={key}>{lab}</label>
                <input
                  id={key}
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  className={field}
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-jubilee-gold-light/80 bg-surface-paper p-4 space-y-3">
            <p className="text-label-sm text-jubilee-gold-deep font-bold uppercase tracking-wide">
              Fee batch range (optional)
            </p>
            <p className="text-body-sm text-on-surface-variant">
              Leave batch from/to blank to use the default fee for every batch. Set a range to
              charge those batches a different amount (₹0 or any nominal fee); everyone else keeps
              the default.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className={label} htmlFor="fee_batch_from">
                  Batch from
                </label>
                <input
                  id="fee_batch_from"
                  type="number"
                  min={1900}
                  step="1"
                  inputMode="numeric"
                  placeholder="e.g. 1986"
                  className={field}
                  value={form.fee_batch_from}
                  onChange={(e) => setField('fee_batch_from', e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="fee_batch_to">
                  Batch to
                </label>
                <input
                  id="fee_batch_to"
                  type="number"
                  min={1900}
                  step="1"
                  inputMode="numeric"
                  placeholder="e.g. 2000"
                  className={field}
                  value={form.fee_batch_to}
                  onChange={(e) => setField('fee_batch_to', e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="fee_batch_rupees">
                  Fee for these batches / person
                </label>
                <input
                  id="fee_batch_rupees"
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  placeholder="0"
                  className={field}
                  value={form.fee_batch_rupees}
                  onChange={(e) => setField('fee_batch_rupees', e.target.value)}
                />
              </div>
            </div>
          </div>
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
        <div className="text-label-sm uppercase tracking-widest text-secondary-container font-bold">
          Sample total
        </div>
        <p className="text-body-sm text-primary-fixed mt-2">
          1 person, lunch + dinner, 4-wheeler
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-label-sm text-primary-fixed">Veg (in fee range)</div>
            <div className="text-headline-md text-secondary-container">
              {formatCostForDisplay(preview.vegIn.totalCost)}
            </div>
          </div>
          {(form.fee_batch_from.trim() || form.fee_batch_to.trim()) && (
            <div>
              <div className="text-label-sm text-primary-fixed">Veg (outside fee range)</div>
              <div className="text-headline-md text-secondary-container">
                {formatCostForDisplay(preview.vegOut.totalCost)}
              </div>
            </div>
          )}
          <div>
            <div className="text-label-sm text-primary-fixed">Non-veg (in fee range)</div>
            <div className="text-headline-md text-secondary-container">
              {formatCostForDisplay(preview.nonveg.totalCost)}
            </div>
          </div>
        </div>
        <p className="text-label-sm text-primary-fixed-dim mt-2">{preview.nonveg.details}</p>
      </aside>
    </form>
  );
}
