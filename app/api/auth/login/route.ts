import { NextResponse } from 'next/server';
import { normalizeLoginId } from '@/lib/auth/identity';
import { verifyPassword } from '@/lib/auth/password';
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { readPackedProfile } from '@/lib/registration/registration-fields';
import { createAdminClient } from '@/lib/supabase-admin';

function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message || '';
  return error.code === 'PGRST204' || error.code === '42703' || /column/i.test(message);
}

type AccountRow = { id: string; email: string; password_hash: string };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId = normalizeLoginId(String(body.username || body.email || ''));
    const password = String(body.password || '');

    if (!loginId || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const account = await findAccount(admin, loginId);
    if (!account) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, account.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = await createSessionToken({ accountId: account.id, email: account.email });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
    return res;
  } catch (err) {
    console.error('login', err);
    return NextResponse.json({ error: 'Server is not configured for login' }, { status: 500 });
  }
}

async function findAccount(
  admin: ReturnType<typeof createAdminClient>,
  loginId: string
): Promise<AccountRow | null> {
  const byUsername = await admin
    .from('alumni_accounts')
    .select('id,email,password_hash')
    .eq('username', loginId)
    .maybeSingle();
  if (!byUsername.error && byUsername.data) return byUsername.data as AccountRow;

  if (!byUsername.error || !missingColumn(byUsername.error)) {
    if (loginId.includes('@')) {
      const byEmail = await admin
        .from('alumni_accounts')
        .select('id,email,password_hash')
        .eq('email', loginId)
        .maybeSingle();
      return (byEmail.data as AccountRow | null) || null;
    }
    return null;
  }

  // ponytail: scans accounts when the username column is not applied yet. Upgrade path is the unique index.
  const { data } = await admin.from('alumni_accounts').select('id,email,password_hash,bio');
  const match = (data || []).find((row) => {
    if (row.email === loginId) return true;
    return readPackedProfile(row.bio)?.username === loginId;
  });
  return (match as AccountRow | undefined) || null;
}
