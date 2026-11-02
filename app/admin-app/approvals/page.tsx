'use client';

import AdminOpsShell from '@/components/admin-ops-shell';
import ApprovalsPanel from '@/components/admin-tools/approvals-panel';

export default function AdminAppApprovalsPage() {
  return (
    <AdminOpsShell title="Approvals">
      <ApprovalsPanel />
    </AdminOpsShell>
  );
}
