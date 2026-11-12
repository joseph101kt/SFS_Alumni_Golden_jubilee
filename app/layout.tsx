// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { EB_Garamond, Manrope } from 'next/font/google';
import './globals.css';
import NavHost from '@/components/nav-host';
import PwaRegister from '@/components/pwa-register';

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-eb-garamond',
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://goldenJubilee.sfsshanthinagar.edu'),
  title: "St. Francis de Sales' High School - Alumni Meet on 50 year aniversary (1976-2026)",
  description:
    'Celebrating 50 glorious years of transformational education. Alumni Meet registration on 50 year aniversary.',
  keywords: ['alumni', 'school reunion', 'SFS Shanthinagar', 'registration'],
  authors: [{ name: "St. Francis de Sales' High School" }],
  // Static file — app/manifest.ts would always win and break /admin-app.webmanifest.
  manifest: '/event-app.webmanifest',
  applicationName: 'SFS Alumni website',
  appleWebApp: {
    capable: true,
    title: 'SFS Alumni',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: ['/icons/icon-192.png'],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  openGraph: {
    title: "St. Francis de Sales' High School - Alumni Meet on 50 year aniversary (1976-2026)",
    description: 'Celebrating 50 glorious years of transformational education.',
    type: 'website',
    url: 'https://goldenJubilee.sfsshanthinagar.edu',
    images: [
      {
        url: '/icons/icon-192.png',
        width: 192,
        height: 192,
        alt: "St. Francis de Sales' High School Golden Jubilee Logo",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#001628',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${ebGaramond.variable} ${manrope.variable} scroll-smooth`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen flex flex-col">
        <PwaRegister />
        <NavHost />
        {children}
      </body>
    </html>
  );
}