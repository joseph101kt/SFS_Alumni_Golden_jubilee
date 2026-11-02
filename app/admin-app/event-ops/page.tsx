'use client';

import AdminOpsShell from '@/components/admin-ops-shell';
import EventOpsPanel from '@/components/admin-tools/event-ops-panel';

export default function AdminAppEventOpsPage() {
  return (
    <AdminOpsShell title="Event ops">
      <EventOpsPanel />
    </AdminOpsShell>
  );
}
