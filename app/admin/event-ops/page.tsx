'use client';

import AdminShell from '@/components/admin-shell';
import EventOpsPanel from '@/components/admin-tools/event-ops-panel';

export default function AdminEventOpsPage() {
  return (
    <AdminShell title="Event ops">
      <EventOpsPanel />
    </AdminShell>
  );
}
