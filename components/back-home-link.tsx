'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const DEFAULT_CLASS =
  'inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant hover:text-primary transition-colors';

/** Back control: /member when signed in, otherwise guestHref (default /). */
export default function BackHomeLink({
  className = DEFAULT_CLASS,
  signedInLabel = 'Back to alumni portal',
  guestLabel = 'Back to Home',
  guestHref = '/',
  showIcon = true,
  /** When parent already knows auth, skip /api/auth/me (avoids race → /). */
  signedIn: knownSignedIn,
}: {
  className?: string;
  signedInLabel?: string;
  guestLabel?: string;
  guestHref?: string;
  showIcon?: boolean;
  signedIn?: boolean;
}) {
  const [signedIn, setSignedIn] = useState(Boolean(knownSignedIn));

  useEffect(() => {
    if (knownSignedIn != null) {
      setSignedIn(knownSignedIn);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (active) setSignedIn(res.ok);
      } catch {
        if (active) setSignedIn(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [knownSignedIn]);

  const href = signedIn ? '/member' : guestHref;
  const label = signedIn ? signedInLabel : guestLabel;

  return (
    <Link href={href} className={className}>
      {showIcon ? (
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
      ) : null}
      {label}
    </Link>
  );
}
