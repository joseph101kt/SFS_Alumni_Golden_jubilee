export const BATCH_START_YEAR = 1986;
export const SECTIONS = ['A', 'B'] as const;
export type Section = (typeof SECTIONS)[number];

export function batchYears(throughYear = new Date().getFullYear()): number[] {
  const years: number[] = [];
  for (let y = throughYear; y >= BATCH_START_YEAR; y -= 1) years.push(y);
  return years;
}

export function isValidBatch(year: number | undefined | null, throughYear = new Date().getFullYear()): boolean {
  return typeof year === 'number' && Number.isInteger(year) && year >= BATCH_START_YEAR && year <= throughYear;
}

export function isValidSection(section: string): section is Section {
  return (SECTIONS as readonly string[]).includes(section);
}

const PROFILE_PACK = 'sfs1:';

export type PackedProfile = {
  section: string;
  lastName: string;
  firstName: string;
  username: string;
};

/** Section, name, and username when those columns are not on alumni_accounts yet. */
export function packProfileFields(
  section: string,
  lastName: string,
  extra?: { firstName?: string; username?: string }
): string {
  return (
    PROFILE_PACK +
    JSON.stringify({
      section: section || '',
      lastName: lastName || '',
      firstName: extra?.firstName || '',
      username: extra?.username || '',
    })
  );
}

export function readPackedProfile(bio: unknown): PackedProfile | null {
  if (typeof bio !== 'string' || !bio.startsWith(PROFILE_PACK)) return null;
  try {
    const parsed = JSON.parse(bio.slice(PROFILE_PACK.length)) as {
      section?: unknown;
      lastName?: unknown;
      firstName?: unknown;
      username?: unknown;
    };
    return {
      section: typeof parsed.section === 'string' ? parsed.section : '',
      lastName: typeof parsed.lastName === 'string' ? parsed.lastName : '',
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
    };
  } catch {
    return null;
  }
}

/** Rewrite the pack without dropping username or first name already stored there. */
export function mergeProfilePack(
  existingBio: unknown,
  patch: Partial<PackedProfile>
): string {
  const prev = readPackedProfile(existingBio);
  return packProfileFields(patch.section ?? prev?.section ?? '', patch.lastName ?? prev?.lastName ?? '', {
    firstName: patch.firstName ?? prev?.firstName ?? '',
    username: patch.username ?? prev?.username ?? '',
  });
}

/** Store city + country as a single location string. */
export function formatLocation(city: string, country: string): string {
  const c = city.trim();
  const countryName = country.trim();
  if (!c || !countryName) return '';
  return `${c}, ${countryName}`;
}

/** Split stored "City, Country" for form fields. */
export function parseLocation(location: string): { city: string; country: string } {
  const raw = String(location || '').trim();
  if (!raw) return { city: '', country: '' };
  const comma = raw.lastIndexOf(',');
  if (comma < 0) return { city: raw, country: '' };
  return {
    city: raw.slice(0, comma).trim(),
    country: raw.slice(comma + 1).trim(),
  };
}
