'use client';

import type { ReactNode } from 'react';
import MemberGate from '@/components/member-gate';

export default function AdminAppGate({ children }: { children: ReactNode }) {
  return (
    <MemberGate mode="admin" loginNext="/admin-app">
      {children}
    </MemberGate>
  );
}
