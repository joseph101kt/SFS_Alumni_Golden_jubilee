'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import MemberGate from '@/components/member-gate';
import PortalShell from '@/components/portal-shell';
import {
  DONATION_AMOUNT_CHIPS_PAISE,
  DONATION_MAX_MESSAGE,
} from '@/lib/donations/validate';
import { openRazorpayCheckout } from '@/lib/payments/checkout-client';

type Cause = {
  id: string;
  title: string;
  description: string | null;
};

function formatInrFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function MemberDonatePage() {
  const [causes, setCauses] = useState<Cause[] | null>(null);
  const [causeId, setCauseId] = useState('');
  const [chipPaise, setChipPaise] = useState<number | null>(DONATION_AMOUNT_CHIPS_PAISE[1]);
  const [customRupees, setCustomRupees] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{
    amount_paise: number;
    causeTitle: string;
    paymentId: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/donations/causes', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setCauses([]);
          setError(payload.error || 'Could not load causes');
          return;
        }
        const list = (payload.causes || []) as Cause[];
        setCauses(list);
        if (list[0]) setCauseId(list[0].id);
      } catch {
        if (active) {
          setCauses([]);
          setError('Could not load causes');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedCause = causes?.find((c) => c.id === causeId) || null;

  function amountPaise(): number | null {
    if (useCustom) {
      const n = Math.round(Number(customRupees) * 100);
      if (!Number.isFinite(n) || n < 100) return null;
      return n;
    }
    return chipPaise;
  }

  async function onPay(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(null);
    const amount = amountPaise();
    if (!causeId) {
      setError('Choose a cause');
      return;
    }
    if (amount == null) {
      setError('Enter at least ₹1');
      return;
    }
    setBusy(true);
    try {
      const orderRes = await fetch('/api/donations/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          causeId,
          amountPaise: amount,
          message,
        }),
      });
      const order = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        setError(order.error || 'Could not start payment');
        return;
      }

      const checkout = await openRazorpayCheckout({
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency || 'INR',
        keyId: order.keyId,
        name: order.name,
        email: order.email,
        contact: order.contact,
        description: order.description || 'Donation',
      });

      if (!checkout) {
        setError('Payment cancelled');
        return;
      }
      if ('failed' in checkout) {
        setError(checkout.message || 'Payment failed');
        return;
      }

      const verifyRes = await fetch('/api/donations/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          donationId: order.donationId,
          razorpay_order_id: checkout.razorpay_order_id,
          razorpay_payment_id: checkout.razorpay_payment_id,
          razorpay_signature: checkout.razorpay_signature,
        }),
      });
      const verified = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        setError(verified.error || 'Could not confirm payment');
        return;
      }

      setSuccess({
        amount_paise: verified.amount_paise || amount,
        causeTitle: selectedCause?.title || 'Donation',
        paymentId: checkout.razorpay_payment_id,
      });
    } catch {
      setError('Payment failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Donate" intro="Support a cause that matters to SFS.">
      <MemberGate>
        {success ? (
          <section className="rounded-2xl border border-outline-variant bg-white p-6 sm:p-8 max-w-xl">
            <p className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
              Thank you
            </p>
            <h2 className="text-headline-md text-primary mt-2">Donation received</h2>
            <p className="text-body-md text-on-surface-variant mt-3">
              {formatInrFromPaise(success.amount_paise)} toward{' '}
              <span className="text-primary font-semibold">{success.causeTitle}</span>.
            </p>
            <p className="text-body-sm text-on-surface-variant mt-2 break-all">
              Reference: {success.paymentId}
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSuccess(null)}
                className="rounded-lg bg-primary text-on-primary px-4 py-2.5 text-label-sm font-bold uppercase tracking-wider"
              >
                Donate again
              </button>
              <Link
                href="/member"
                className="rounded-lg border border-outline-variant px-4 py-2.5 text-label-sm uppercase tracking-wider text-primary"
              >
                Back home
              </Link>
            </div>
          </section>
        ) : (
          <form
            onSubmit={onPay}
            className="rounded-2xl border border-outline-variant bg-white p-5 sm:p-7 max-w-xl space-y-5"
          >
            <div>
              <p className="text-label-sm uppercase tracking-wider text-primary mb-2">Cause</p>
              {causes === null ? (
                <p className="text-body-sm text-on-surface-variant">Loading…</p>
              ) : !causes.length ? (
                <p className="text-body-sm text-on-surface-variant">
                  No active causes yet. Check back soon.
                </p>
              ) : (
                <ul className="space-y-2">
                  {causes.map((c) => (
                    <li key={c.id}>
                      <label
                        className={`flex gap-3 rounded-xl border px-3 py-3 cursor-pointer ${
                          causeId === c.id
                            ? 'border-jubilee-gold-deep bg-jubilee-gold-light/40'
                            : 'border-outline-variant'
                        }`}
                      >
                        <input
                          type="radio"
                          name="cause"
                          className="mt-1 accent-primary"
                          checked={causeId === c.id}
                          onChange={() => setCauseId(c.id)}
                          disabled={busy}
                        />
                        <span className="min-w-0">
                          <span className="block text-body-md text-primary font-semibold">
                            {c.title}
                          </span>
                          {c.description ? (
                            <span className="block text-body-sm text-on-surface-variant mt-0.5">
                              {c.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-label-sm uppercase tracking-wider text-primary mb-2">Amount</p>
              <div className="flex flex-wrap gap-2">
                {DONATION_AMOUNT_CHIPS_PAISE.map((paise) => (
                  <button
                    key={paise}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setUseCustom(false);
                      setChipPaise(paise);
                    }}
                    className={`rounded-full px-4 py-2 text-label-sm font-bold ${
                      !useCustom && chipPaise === paise
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-primary'
                    }`}
                  >
                    {formatInrFromPaise(paise)}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUseCustom(true)}
                  className={`rounded-full px-4 py-2 text-label-sm font-bold ${
                    useCustom ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary'
                  }`}
                >
                  Custom
                </button>
              </div>
              {useCustom ? (
                <label className="block mt-3">
                  <span className="sr-only">Custom amount in rupees</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={customRupees}
                    onChange={(e) => setCustomRupees(e.target.value)}
                    disabled={busy}
                    placeholder="Amount in ₹"
                    className="w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary"
                  />
                </label>
              ) : null}
            </div>

            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                Message (optional)
              </span>
              <textarea
                rows={3}
                maxLength={DONATION_MAX_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={busy}
                className="mt-1 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface resize-y focus:outline-none focus:border-primary"
                placeholder="A short note with your gift"
              />
              <span className="text-body-sm text-on-surface-variant">
                {message.length}/{DONATION_MAX_MESSAGE}
              </span>
            </label>

            {error ? (
              <p className="rounded-lg bg-error-container text-error text-body-sm p-3">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !causes?.length}
              className="w-full rounded-lg bg-primary text-on-primary px-4 py-3 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {busy ? 'Opening payment…' : 'Pay with Razorpay'}
            </button>
            <p className="text-body-sm text-on-surface-variant text-center">
              Secure checkout via Razorpay · UPI and cards
            </p>
          </form>
        )}
      </MemberGate>
    </PortalShell>
  );
}
