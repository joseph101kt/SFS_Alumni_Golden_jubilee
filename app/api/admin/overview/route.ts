import { NextResponse } from 'next/server';
import { amountDuePaise } from '@/lib/admin/event-exceptions';
import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const me = await requireVerifiedAdmin();
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();

  const pendingMembers = await admin
    .from('alumni_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('member_status', 'pending');

  let publishedEvents = 0;
  let unpaidRegistrations = 0;
  let registrationCount = 0;
  let amountPaidPaise = 0;
  let amountDuePaiseTotal = 0;

  const events = await admin.from('event_catalog').select('id').eq('published', true);
  const catalogReady = !events.error;
  if (catalogReady) publishedEvents = (events.data || []).length;

  const regs = await admin
    .from('event_registrations')
    .select('id,payment_status,total_cost_paise,amount_paid_paise');
  if (!regs.error && regs.data) {
    registrationCount = regs.data.length;
    for (const r of regs.data) {
      const paid = Math.max(0, Number(r.amount_paid_paise) || 0);
      const total = Math.max(0, Number(r.total_cost_paise) || 0);
      amountPaidPaise += paid;
      amountDuePaiseTotal += amountDuePaise(total, paid);
      const status = String(r.payment_status || '');
      if (status === 'pending' || status === 'partial') unpaidRegistrations += 1;
    }
  }

  let pendingMemories = 0;
  const mem = await admin
    .from('alumni_memories')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (!mem.error) pendingMemories = mem.count || 0;

  let pendingStories = 0;
  const sto = await admin
    .from('alumni_stories')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (!sto.error) pendingStories = sto.count || 0;

  const pendingApprovals = (pendingMembers.count || 0) + pendingMemories + pendingStories;

  return NextResponse.json({
    pendingMembers: pendingMembers.count || 0,
    publishedEvents,
    unpaidRegistrations,
    pendingMemories,
    pendingStories,
    pendingApprovals,
    registrationCount,
    amountPaidPaise,
    amountDuePaise: amountDuePaiseTotal,
    catalogReady,
  });
}
