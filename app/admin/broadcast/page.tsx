'use client';

import AdminShell from '@/components/admin-shell';
import BroadcastPanel from '@/components/admin-tools/broadcast-panel';

export default function AdminBroadcastPage() {
  return (
    <AdminShell title="Broadcast">
      <BroadcastPanel />
    </AdminShell>
  );
}
