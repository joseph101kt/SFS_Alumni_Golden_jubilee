import { readPackedProfile } from '@/lib/registration/registration-fields';
import { createAdminClient } from '@/lib/supabase-admin';

function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message || '';
  return error.code === 'PGRST204' || error.code === '42703' || /column/i.test(message);
}

export type RecoverAccountRow = {
  id: string;
  email: string;
  phone_number: string | null;
  batch: number | null;
  recovery_q1: string | null;
  recovery_a1_hash: string | null;
  recovery_q2: string | null;
  recovery_a2_hash: string | null;
};

const RECOVER_SELECT =
  'id,email,phone_number,batch,recovery_q1,recovery_a1_hash,recovery_q2,recovery_a2_hash';

/** Lookup by username, then email. Used by login-adjacent recover flows. */
export async function findAccountForRecover(
  admin: ReturnType<typeof createAdminClient>,
  loginId: string
): Promise<RecoverAccountRow | null> {
  const byUsername = await admin
    .from('alumni_accounts')
    .select(RECOVER_SELECT)
    .eq('username', loginId)
    .maybeSingle();
  if (!byUsername.error && byUsername.data) return normalizeRecoverRow(byUsername.data);

  if (byUsername.error && missingColumn(byUsername.error)) {
    return findAccountLegacy(admin, loginId);
  }

  if (loginId.includes('@')) {
    const byEmail = await admin
      .from('alumni_accounts')
      .select(RECOVER_SELECT)
      .eq('email', loginId)
      .maybeSingle();
    if (!byEmail.error && byEmail.data) return normalizeRecoverRow(byEmail.data);
    if (byEmail.error && missingColumn(byEmail.error)) {
      return findAccountLegacy(admin, loginId);
    }
  }
  return null;
}

function normalizeRecoverRow(row: Record<string, unknown>): RecoverAccountRow {
  return {
    id: String(row.id),
    email: String(row.email),
    phone_number: row.phone_number != null ? String(row.phone_number) : null,
    batch: row.batch != null ? Number(row.batch) : null,
    recovery_q1: row.recovery_q1 != null ? String(row.recovery_q1) : null,
    recovery_a1_hash: row.recovery_a1_hash != null ? String(row.recovery_a1_hash) : null,
    recovery_q2: row.recovery_q2 != null ? String(row.recovery_q2) : null,
    recovery_a2_hash: row.recovery_a2_hash != null ? String(row.recovery_a2_hash) : null,
  };
}

async function findAccountLegacy(
  admin: ReturnType<typeof createAdminClient>,
  loginId: string
): Promise<RecoverAccountRow | null> {
  // ponytail: scans when username/recovery columns missing. Upgrade path: apply migrations.
  const { data } = await admin
    .from('alumni_accounts')
    .select('id,email,phone_number,batch,bio,username');
  const match = (data || []).find((row) => {
    if (row.email === loginId) return true;
    if ((row as { username?: string }).username === loginId) return true;
    return readPackedProfile(row.bio)?.username === loginId;
  });
  return match ? normalizeRecoverRow(match) : null;
}
