import { NextResponse } from 'next/server';
import { getDayOfInfo } from '@/lib/events/day-of';
import { getPrimaryEvent } from '@/lib/events/primary';

export async function GET() {
  const base = getDayOfInfo();
  const primary = await getPrimaryEvent().catch(() => null);
  if (!primary) return NextResponse.json(base);

  const when = (() => {
    const day = (iso: string) =>
      new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    const start = day(primary.starts_at);
    const end = primary.ends_at ? day(primary.ends_at) : '';
    return end && end !== start ? `${start} – ${end}` : start;
  })();

  return NextResponse.json({
    ...base,
    headline: primary.title || base.headline,
    when: process.env.NEXT_PUBLIC_EVENT_DAY_WHEN || when,
    venue: process.env.NEXT_PUBLIC_EVENT_DAY_VENUE || primary.venue || base.venue,
  });
}
