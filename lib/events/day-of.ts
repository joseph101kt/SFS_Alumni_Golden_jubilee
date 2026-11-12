/** Day-of content for the event PWA. Override via env for the weekend. */

export type DayOfInfo = {
  headline: string;
  when: string;
  venue: string;
  mapUrl: string;
  parkingNote: string;
  helpText: string;
  helpPhone: string;
};

export function getDayOfInfo(): DayOfInfo {
  return {
    headline: process.env.NEXT_PUBLIC_EVENT_DAY_HEADLINE || 'Alumni Meet',
    when: process.env.NEXT_PUBLIC_EVENT_DAY_WHEN || 'Follow your venue pass for timing',
    venue: process.env.NEXT_PUBLIC_EVENT_DAY_VENUE || 'SFS High School, Shanthinagar',
    mapUrl: process.env.NEXT_PUBLIC_EVENT_DAY_MAP_URL || 'https://maps.google.com/?q=SFS+High+School+Shanthinagar',
    parkingNote:
      process.env.NEXT_PUBLIC_EVENT_DAY_PARKING ||
      'Follow volunteer directions for 2-wheeler and 4-wheeler parking.',
    helpText:
      process.env.NEXT_PUBLIC_EVENT_DAY_HELP ||
      'For gate or registration help, contact the alumni desk.',
    helpPhone: process.env.NEXT_PUBLIC_EVENT_DAY_HELP_PHONE || '',
  };
}
