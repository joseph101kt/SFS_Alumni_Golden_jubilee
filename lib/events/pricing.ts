// lib/events/pricing.ts
// Parsing and display helpers for event fees. The fee amount itself lives in
// lib/registration/registration, so the form, the summary, and the event cards share one source.

import { EVENT_FEE_PER_PERSON_PAISE, formatCostForDisplay } from '@/lib/registration/registration';

export function parseOptionalBatchYear(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1900) return null;
  return n;
}

export function parseNonNegInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

/** Convert rupees (form input) to paise. */
export function rupeesToPaise(rupees: unknown): number {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** One-line fee summary for event cards. */
export function eventFeeSummary(): string {
  return `Event fee ${formatCostForDisplay(EVENT_FEE_PER_PERSON_PAISE)} per person`;
}