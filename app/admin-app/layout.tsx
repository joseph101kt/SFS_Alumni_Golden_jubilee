import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AdminAppGate from '@/components/admin-app-gate';

export const metadata: Metadata = {
  manifest: '/admin-app.webmanifest',
  applicationName: 'SFS Committee Ops',
  appleWebApp: {
    capable: true,
    title: 'SFS Ops',
    statusBarStyle: 'default',
  },
};

export default function AdminAppLayout({ children }: { children: ReactNode }) {
  return <AdminAppGate>{children}</AdminAppGate>;
}
