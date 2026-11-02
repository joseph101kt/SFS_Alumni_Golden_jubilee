'use client';

import AdminShell from '@/components/admin-shell';
import ApprovalsPanel from '@/components/admin-tools/approvals-panel';

export default function AdminApprovalsPage() {
  return (
    <AdminShell title="Approvals">
      <ApprovalsPanel />
    </AdminShell>
  );
}
