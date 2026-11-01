function rupeesLine(paise: number) {
  return `₹${(Math.max(0, Number(paise) || 0) / 100).toFixed(2)}`;
}

export function normalizeRefundEmail(raw: unknown): string | null {
  const email = String(raw || '')
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function buildRefundMailto(opts: {
  email: string;
  eventTitle: string;
  fullName: string;
  registrationCode?: string | null;
  totalPaise: number;
  paidPaise: number;
}): string {
  const credit = Math.max(0, opts.paidPaise - opts.totalPaise);
  const subject = `Refund request — ${opts.eventTitle}`;
  const lines = [
    `Hello committee,`,
    ``,
    `I would like to request a refund related to my registration.`,
    ``,
    `Name: ${opts.fullName || '—'}`,
    `Event: ${opts.eventTitle}`,
    `Registration ID: ${opts.registrationCode || '—'}`,
    `Total: ${rupeesLine(opts.totalPaise)}`,
    `Paid: ${rupeesLine(opts.paidPaise)}`,
  ];
  if (credit > 0) {
    lines.push(`Possible credit: ${rupeesLine(credit)}`);
  }
  lines.push(``, `Thank you.`);
  const body = lines.join('\n');
  return `mailto:${encodeURIComponent(opts.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
