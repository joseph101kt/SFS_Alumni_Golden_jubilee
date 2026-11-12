export type JubileeRegStatus = 'none' | 'pending_payment' | 'paid';

export type JubileeAccountHint = {
  role: 'alumni' | 'admin';
  jubilee_reg_status?: JubileeRegStatus | null;
};

export type JubileeCta = {
  /** Show a primary registration-related CTA */
  show: boolean;
  href: string;
  label: string;
};

export function jubileeCta(account: JubileeAccountHint | null | undefined): JubileeCta {
  if (!account) {
    return { show: true, href: '/registration', label: 'Register for Alumni Meet' };
  }
  if (account.role === 'admin') {
    return { show: false, href: '/admin', label: '' };
  }
  const status = account.jubilee_reg_status || 'none';
  if (status === 'paid') {
    return { show: false, href: '/member', label: '' };
  }
  if (status === 'pending_payment') {
    return { show: true, href: '/registration', label: 'Complete payment' };
  }
  return { show: true, href: '/registration', label: 'Register for Alumni Meet' };
}

/** Compact nav label (shorter than hero). */
export function jubileeNavCta(account: JubileeAccountHint | null | undefined): JubileeCta {
  const cta = jubileeCta(account);
  if (!account) return { show: true, href: '/registration', label: 'Register' };
  if (account.role === 'admin') return { show: false, href: '/admin', label: '' };
  if (account.jubilee_reg_status === 'paid') {
    return { show: false, href: '/member', label: '' };
  }
  if (account.jubilee_reg_status === 'pending_payment') {
    return { show: true, href: '/registration', label: 'Complete payment' };
  }
  return { show: true, href: '/registration', label: 'Register' };
}

export function postAuthPath(account: JubileeAccountHint): string {
  if (account.role === 'admin') return '/admin';
  const status = account.jubilee_reg_status || 'none';
  if (status === 'paid') return '/member';
  return '/registration';
}
