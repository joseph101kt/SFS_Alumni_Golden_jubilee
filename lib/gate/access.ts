import { requireVerifiedAdmin } from '@/lib/auth/admin-guard';
import { hasGateSession } from '@/lib/gate/session';

/** Gate PIN session or verified admin may use gate check-in APIs. */
export async function requireGateOrAdmin(): Promise<{ ok: true; actor: string } | { ok: false }> {
  if (await hasGateSession()) return { ok: true, actor: 'gate' };
  const admin = await requireVerifiedAdmin();
  if (admin) return { ok: true, actor: `admin:${admin.id}` };
  return { ok: false };
}
