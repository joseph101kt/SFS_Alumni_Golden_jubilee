'use client';

import AdminOpsShell from '@/components/admin-ops-shell';
import BroadcastPanel from '@/components/admin-tools/broadcast-panel';

export default function AdminAppBroadcastPage() {
  return (
    <AdminOpsShell title="Broadcast">
      <BroadcastPanel />
    </AdminOpsShell>
  );
}
