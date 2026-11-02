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
  icons: {
    icon: [
      { url: '/icons/icon-ops-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-ops-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-ops-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export default function AdminAppLayout({ children }: { children: ReactNode }) {
  return <AdminAppGate>{children}</AdminAppGate>;
}
