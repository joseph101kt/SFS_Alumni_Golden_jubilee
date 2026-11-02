'use client';

import type { ReactNode } from 'react';
import MemberGate from '@/components/member-gate';
import PortalShell from '@/components/portal-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalShell title="Alumni committee" eyebrow="ALUMNI COMMITTEE WORKSPACE" sidebar={false}>
      <MemberGate mode="admin" loginNext="/admin">
        <div className="rounded-3xl border border-jubilee-gold-light/80 bg-surface-ivory shadow-[0_8px_30px_rgba(0,22,40,0.06)] p-5 sm:p-7 lg:p-8 print:rounded-none print:border-0 print:shadow-none print:bg-white print:p-0">
          {children}
        </div>
      </MemberGate>
    </PortalShell>
  );
}
