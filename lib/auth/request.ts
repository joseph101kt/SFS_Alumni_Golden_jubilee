import { cookies } from 'next/headers';
import { COOKIE_NAME, verifySessionToken, type SessionPayload } from '@/lib/auth/session';
import { readPackedProfile } from '@/lib/registration/registration-fields';
import { createAdminClient } from '@/lib/supabase-admin';

import type { JubileeRegStatus } from '@/lib/jubilee-cta';

export type AlumniAccount = {
  id: string;
  email: string;
  full_name: string;
  last_name: string | null;
  phone_number: string | null;
  role: 'alumni' | 'admin';
  member_status: 'pending' | 'verified' | 'rejected' | 'suspended';
  jubilee_reg_status: JubileeRegStatus;
  batch: number | null;
  section: string | null;
  current_location: string | null;
};

const ACCOUNT_SELECT_FULL =
  'id,email,full_name,last_name,phone_number,role,member_status,jubilee_reg_status,batch,section,current_location';
const ACCOUNT_SELECT_CORE =
  'id,email,full_name,phone_number,role,member_status,jubilee_reg_status,batch,current_location,bio';
const ACCOUNT_SELECT_MIN = 'id,email,full_name,phone_number,role,member_status';

function normalizeAccount(row: Record<string, unknown>): AlumniAccount {
  const packed = readPackedProfile(row.bio);
  const lastName = row.last_name != null ? String(row.last_name) : packed?.lastName || '';
  const section = row.section != null ? String(row.section) : packed?.section || '';
  return {
    id: String(row.id),
    email: String(row.email),
    full_name: String(row.full_name || ''),
    last_name: lastName || null,
    phone_number: row.phone_number != null ? String(row.phone_number) : null,
    role: row.role === 'admin' ? 'admin' : 'alumni',
    member_status: (row.member_status as AlumniAccount['member_status']) || 'pending',
    jubilee_reg_status: (row.jubilee_reg_status as JubileeRegStatus) || 'none',
    batch: typeof row.batch === 'number' ? row.batch : row.batch != null ? Number(row.batch) || null : null,
    section: section || null,
    current_location: row.current_location != null ? String(row.current_location) : null,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentAccount(): Promise<AlumniAccount | null> {
  const session = await getSession();
  if (!session) return null;
  const admin = createAdminClient();

  for (const select of [ACCOUNT_SELECT_FULL, ACCOUNT_SELECT_CORE, ACCOUNT_SELECT_MIN]) {
    const res = await admin
      .from('alumni_accounts')
      .select(select)
      .eq('id', session.accountId)
      .maybeSingle();
    if (!res.error && res.data) return normalizeAccount(res.data as unknown as Record<string, unknown>);
  }
  return null;
}
