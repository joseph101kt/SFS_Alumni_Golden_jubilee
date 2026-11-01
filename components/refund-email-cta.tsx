import { buildRefundMailto, normalizeRefundEmail } from '@/lib/events/refund-mailto';
import { formatCostForDisplay } from '@/lib/registration';

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
  const email = normalizeRefundEmail(refundEmail);
  if (!email || paidPaise <= 0) return null;

  const credit = Math.max(0, paidPaise - totalPaise);
  const href = buildRefundMailto({
    email,
    eventTitle,
    fullName,
    registrationCode,
    totalPaise,
    paidPaise,
  });

  return (
    <div
      className={`rounded-lg border p-4 text-body-sm ${
        credit > 0
          ? 'border-jubilee-gold-deep/40 bg-secondary-container/40 text-on-secondary-fixed-variant'
          : 'border-outline-variant bg-surface-paper text-on-surface-variant'
      }`}
    >
      {credit > 0 ? (
        <p className="font-medium text-primary mb-1">
          You may have a credit of {formatCostForDisplay(credit)} (paid more than the current total).
        </p>
      ) : (
        <p className="mb-1">Need a refund for this registration?</p>
      )}
      <p>
        Email the alumni committee at{' '}
        <a href={href} className="font-bold text-primary underline underline-offset-2">
          {email}
        </a>
        .
      </p>
    </div>
  );
}
