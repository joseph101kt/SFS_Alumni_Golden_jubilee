import {
  buildRefundEmailBody,
  buildRefundMailto,
  normalizeRefundEmail,
  refundAmountPaise,
} from '@/lib/events/refund-mailto';
import { formatCostForDisplay } from '@/lib/registration/registration';

export default function RefundEmailCta({
  refundEmail,
  eventTitle,
  fullName,
  registrationCode,
  totalPaise,
  paidPaise,
}: {
  refundEmail?: string | null;
  eventTitle: string;
  fullName: string;
  registrationCode?: string | null;
  totalPaise: number;
  paidPaise: number;
}) {
  if (paidPaise <= 0) return null;

  const email = normalizeRefundEmail(refundEmail);
  const refundPaise = refundAmountPaise(totalPaise, paidPaise);
  if (!email && refundPaise <= 0) return null;

  const draft = buildRefundEmailBody({
    eventTitle,
    fullName,
    registrationCode,
    totalPaise,
    paidPaise,
  });

  const href = email
    ? buildRefundMailto({
        email,
        eventTitle,
        fullName,
        registrationCode,
        totalPaise,
        paidPaise,
      })
    : null;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 text-body-sm ${
        refundPaise > 0
          ? 'border-jubilee-gold-deep/50 bg-secondary-container/50 text-on-secondary-fixed-variant'
          : 'border-outline-variant bg-surface-paper text-on-surface-variant'
      }`}
    >
      {refundPaise > 0 ? (
        <div>
          <p className="text-label-sm uppercase tracking-wide text-jubilee-gold-deep font-bold">
            Refund due
          </p>
          <p className="text-headline-sm text-primary mt-1 tabular-nums">
            {formatCostForDisplay(refundPaise)}
          </p>
          <p className="mt-1 text-on-surface-variant">
            Paid {formatCostForDisplay(paidPaise)} − current total{' '}
            {formatCostForDisplay(totalPaise)}.
          </p>
        </div>
      ) : (
        <p>Need a refund for this registration?</p>
      )}

      {href && email ? (
        <div className="space-y-2">
          <a
            href={href}
            className="inline-flex items-center justify-center rounded-lg bg-primary text-on-primary px-4 py-2.5 text-label-sm font-bold hover:bg-primary-container cursor-pointer"
          >
            {refundPaise > 0
              ? `Email committee to request ${formatCostForDisplay(refundPaise)} refund`
              : 'Email committee for a refund'}
          </a>
          <p className="text-label-sm text-on-surface-variant">
            Opens your email app to {email} with this message ready to send.
          </p>
          <details className="text-label-sm text-on-surface-variant">
            <summary className="cursor-pointer font-medium text-primary">Preview email</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md border border-outline-variant bg-surface-paper p-3 text-[12px] leading-relaxed text-on-surface">
              Subject: {draft.subject}
              {'\n\n'}
              {draft.body}
            </pre>
          </details>
        </div>
      ) : (
        <p>
          Contact the alumni committee to request
          {refundPaise > 0 ? ` ${formatCostForDisplay(refundPaise)}` : ' a'} refund. Set the
          committee refund email on this event to enable one-click email.
        </p>
      )}
    </div>
  );
}
