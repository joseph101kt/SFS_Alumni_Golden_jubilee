import { NextResponse } from 'next/server';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();

  const [members, memories, stories] = await Promise.all([
    admin
      .from('alumni_accounts')
      .select('id,full_name,email,phone_number,batch,created_at')
      .eq('member_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50),
    admin
      .from('alumni_memories')
      .select('id,title,image_url,batch_year,batch_label,created_at,submitted_by')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50),
    admin
      .from('alumni_stories')
      .select('id,title,body,created_at,author_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50),
  ]);

  const accountIds = new Set<string>();
  for (const m of memories.data || []) {
    if (m.submitted_by) accountIds.add(String(m.submitted_by));
  }
  for (const s of stories.data || []) {
    if (s.author_id) accountIds.add(String(s.author_id));
  }

  const names = new Map<string, string>();
  if (accountIds.size) {
    const { data: accounts } = await admin
      .from('alumni_accounts')
      .select('id,full_name')
      .in('id', [...accountIds]);
    for (const a of accounts || []) names.set(String(a.id), String(a.full_name || ''));
  }

  return NextResponse.json({
    counts: {
      memberships: members.error ? 0 : members.data?.length || 0,
      memories: memories.error ? 0 : memories.data?.length || 0,
      stories: stories.error ? 0 : stories.data?.length || 0,
    },
    memberships: members.error ? [] : members.data || [],
    memories: memories.error
      ? []
      : (memories.data || []).map((m) => ({
          ...m,
          submitter_name: m.submitted_by ? names.get(String(m.submitted_by)) || null : null,
        })),
    stories: stories.error
      ? []
      : (stories.data || []).map((s) => ({
          ...s,
          author_name: s.author_id ? names.get(String(s.author_id)) || null : null,
        })),
    errors: {
      memberships: members.error?.message || null,
      memories: memories.error?.message || null,
      stories: stories.error?.message || null,
    },
  });
}
