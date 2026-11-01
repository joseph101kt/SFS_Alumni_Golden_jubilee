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
  if (paidPaise <= 0) return null;

  const email = normalizeRefundEmail(refundEmail);
  const credit = Math.max(0, paidPaise - totalPaise);
  // Always surface overpayment; otherwise only when a committee email is configured.
  if (!email && credit <= 0) return null;

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
      className={`rounded-lg border p-4 text-body-sm ${
        credit > 0
          ? 'border-jubilee-gold-deep/50 bg-secondary-container/50 text-on-secondary-fixed-variant'
          : 'border-outline-variant bg-surface-paper text-on-surface-variant'
      }`}
    >
      {credit > 0 ? (
        <p className="font-medium text-primary mb-2">
          You may have a credit of {formatCostForDisplay(credit)} (paid more than the current
          total).
        </p>
      ) : (
        <p className="mb-2">Need a refund for this registration?</p>
      )}
      {href && email ? (
        <p>
          Email the alumni committee to request a refund:{' '}
          <a
            href={href}
            className="inline-flex font-bold text-primary underline underline-offset-2 break-all"
          >
            {email}
          </a>
        </p>
      ) : (
        <p>
          Contact the alumni committee to request a refund. (Committee refund email is not set on
          this event yet.)
        </p>
      )}
    </div>
  );
}
