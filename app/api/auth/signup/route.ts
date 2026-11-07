import { NextResponse } from 'next/server';
import { joinName, passwordsMatch, resolveUsername, usernameError } from '@/lib/auth/identity';
import { hashPassword } from '@/lib/auth/password';
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { isPublicEmail, normalizeEmail } from '@/lib/email';
import { phoneValidationError, toE164 } from '@/lib/phone';
import { packProfileFields, readPackedProfile } from '@/lib/registration/registration-fields';
import { createAdminClient } from '@/lib/supabase-admin';

function missingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message || '';
  return error.code === 'PGRST204' || error.code === '42703' || /column/i.test(message);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ''));
    const password = String(body.password || '');
    const passwordConfirm = String(body.passwordConfirm ?? '');
    const firstName = String(body.firstName || '').trim().replace(/\s+/g, ' ');
    const lastName = String(body.lastName || '').trim().replace(/\s+/g, ' ');
    const username = resolveUsername(String(body.username || ''), email);
    const phoneIsd = String(body.phoneIsd || body.isd || '').trim();
    const phoneNational = String(body.phoneNational || body.phoneNumber || '').trim();
    const fullName = joinName(firstName, lastName);

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      );
    }
    if (!isPublicEmail(email)) {
      return NextResponse.json(
        {
          error:
            'Use a public email address (Gmail, Yahoo, Outlook, iCloud, Proton, Rediffmail, AOL, or Zoho)',
        },
        { status: 400 }
      );
    }
    const nameError = usernameError(username);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    if (!passwordsMatch(password, passwordConfirm)) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const phoneErr = phoneValidationError(phoneIsd, phoneNational);
    const e164 = phoneErr ? null : toE164(phoneIsd, phoneNational);
    if (phoneErr || !e164) {
      return NextResponse.json(
        {
          error:
            phoneErr ||
            'Enter a valid phone number with country code (ISD) and national number',
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: emailOwner } = await admin
      .from('alumni_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (emailOwner) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const usernameTaken = await usernameIsTaken(admin, username, email);
    if (usernameTaken) {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const bio = packProfileFields('', lastName, { firstName, username });
    const baseRow = {
      email,
      password_hash: passwordHash,
      full_name: fullName,
      phone_number: e164,
      role: 'alumni' as const,
      member_status: 'pending' as const,
      bio,
    };
    const withColumns = {
      ...baseRow,
      first_name: firstName,
      last_name: lastName,
      username,
    };

    let inserted = await admin.from('alumni_accounts').insert(withColumns).select('id,email').single();
    if (missingColumn(inserted.error)) {
      inserted = await admin.from('alumni_accounts').insert(baseRow).select('id,email').single();
    }

    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === '23505') {
        return NextResponse.json(
          { error: 'An account with this email or username already exists' },
          { status: 409 }
        );
      }
      console.error('signup insert', inserted.error);
      return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
    }

    const token = await createSessionToken({ accountId: inserted.data.id, email: inserted.data.email });
    const res = NextResponse.json({ ok: true }, { status: 201 });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions);
    return res;
  } catch (err) {
    console.error('signup', err);
    return NextResponse.json({ error: 'Server is not configured for signup' }, { status: 500 });
  }
}

async function usernameIsTaken(
  admin: ReturnType<typeof createAdminClient>,
  username: string,
  email: string
): Promise<boolean> {
  if (username !== email) {
    const byEmail = await admin.from('alumni_accounts').select('id').eq('email', username).maybeSingle();
    if (byEmail.data) return true;
  }

  const byColumn = await admin.from('alumni_accounts').select('id').eq('username', username).maybeSingle();
  if (!byColumn.error) return Boolean(byColumn.data);
  if (!missingColumn(byColumn.error)) return false;

  // ponytail: scans accounts until alumni_accounts.username exists. Upgrade path is the unique index.
  const { data } = await admin.from('alumni_accounts').select('id,email,bio');
  return (data || []).some((row) => {
    if (row.email === username && username !== email) return true;
    return readPackedProfile(row.bio)?.username === username;
  });
}
