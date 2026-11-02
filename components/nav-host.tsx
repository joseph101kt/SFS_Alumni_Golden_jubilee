import { headers } from 'next/headers';
import NavBar from '@/components/navbar';

function hideSiteChrome(pathname: string) {
  return (
    pathname === '/event-app' ||
    pathname.startsWith('/event-app/') ||
    pathname === '/gate' ||
    pathname.startsWith('/gate/') ||
    pathname === '/admin-app' ||
    pathname.startsWith('/admin-app/')
  );
}

/** Server-side: never send Login / Association / Signup on event-app or gate. */
export default async function NavHost() {
  const pathname = (await headers()).get('x-pathname') || '';
  if (hideSiteChrome(pathname)) return null;
  return <NavBar />;
}
