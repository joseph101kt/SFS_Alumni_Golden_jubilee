function rupeesLine(paise: number) {
  return `₹${(Math.max(0, Number(paise) || 0) / 100).toFixed(2)}`;
}

/** Paid minus current total; 0 when nothing to refund. */
export function refundAmountPaise(totalPaise: number, paidPaise: number): number {
  const total = Math.max(0, Math.floor(Number(totalPaise) || 0));
  const paid = Math.max(0, Math.floor(Number(paidPaise) || 0));
  return Math.max(0, paid - total);
}

export function normalizeRefundEmail(raw: unknown): string | null {
  const email = String(raw || '')
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function buildRefundEmailBody(opts: {
  eventTitle: string;
  fullName: string;
  registrationCode?: string | null;
  totalPaise: number;
  paidPaise: number;
}): { refundPaise: number; subject: string; body: string } {
  const refundPaise = refundAmountPaise(opts.totalPaise, opts.paidPaise);
  const subject =
    refundPaise > 0
      ? `Refund request ${rupeesLine(refundPaise)} — ${opts.eventTitle}`
      : `Refund request — ${opts.eventTitle}`;

  const lines = [
    `Hello committee,`,
    ``,
    refundPaise > 0
      ? `Please process a refund of ${rupeesLine(refundPaise)} for my registration.`
      : `I would like to request a refund related to my registration.`,
    ``,
    `---`,
    `Name: ${opts.fullName || '—'}`,
    `Event: ${opts.eventTitle}`,
    `Registration ID: ${opts.registrationCode || '—'}`,
    `Current total: ${rupeesLine(opts.totalPaise)}`,
    `Amount paid: ${rupeesLine(opts.paidPaise)}`,
    `Refund amount: ${rupeesLine(refundPaise)}`,
    `---`,
    ``,
    `Thank you.`,
  ];

  return { refundPaise, subject, body: lines.join('\n') };
}

export function buildRefundMailto(opts: {
  email: string;
  eventTitle: string;
  fullName: string;
  registrationCode?: string | null;
  totalPaise: number;
  paidPaise: number;
}): string {
  const { subject, body } = buildRefundEmailBody(opts);
  return `mailto:${encodeURIComponent(opts.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
