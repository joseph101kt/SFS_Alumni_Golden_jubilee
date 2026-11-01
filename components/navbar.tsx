// components/navbar.tsx

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AssociationModal from '@/components/association-modal';

export default function NavBar() {
    const [user, setUser] = useState<{ email: string; isAdmin: boolean } | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [associationOpen, setAssociationOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const onPortal =
        pathname === '/member' ||
        pathname.startsWith('/member/') ||
        pathname === '/directory' ||
        pathname === '/events' ||
        pathname === '/stories' ||
        pathname === '/memories' ||
        pathname === '/submissions' ||
        pathname === '/admin' ||
        pathname.startsWith('/admin/');

    useEffect(() => {
        let active = true;
        async function checkAuth() {
            try {
                const res = await fetch('/api/auth/me', { cache: 'no-store' });
                if (!active) return;
                if (res.ok) {
                    const me = await res.json();
                    setUser({
                        email: me.email,
                        isAdmin: me.role === 'admin' && me.member_status === 'verified',
                    });
                } else {
                    setUser(null);
                }
            } catch {
                if (active) setUser(null);
            }
        }
        void checkAuth();
        return () => {
            active = false;
        };
    }, [pathname]);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        setMobileMenuOpen(false);
        router.push('/');
        router.refresh();
    }

    return (
        <header className="print:hidden fixed top-0 left-0 w-full z-50 bg-surface-paper/95 backdrop-blur-sm border-b border-outline-variant">
            <div className="h-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-4">
                <Link
                    className="flex items-center gap-2.5 sm:gap-3.5 group text-left min-w-0 flex-1 max-w-[min(100%,28rem)] lg:max-w-none"
                    href="/"
                    aria-label="Go to landing page"
                >
                    <div className="relative flex-shrink-0">
                        <img
                            alt="SFS Shanthinagar Emblem"
                            className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-full shadow-[0_2px_8px_rgba(184,134,11,0.15)]"
                            src="/images/emblem.png"
                        />
                    </div>
                    <div className="flex flex-col truncate">
                        <span className="text-sm sm:text-headline-sm text-primary tracking-tight leading-tight font-semibold truncate group-hover:text-navy-subtle transition-colors">
                            St. Francis de Sales' High School
                        </span>
                        <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                            <span className="text-[12px] sm:text-label-sm uppercase tracking-widest text-on-surface-variant truncate">
                                Shanthinagar, Secunderabad
                            </span>
                            <span className="inline-block w-1 h-1 rounded-full bg-jubilee-amber flex-shrink-0"></span>
                            <span className="text-[12px] sm:text-label-sm uppercase tracking-wider text-jubilee-gold-deep font-bold truncate">
                                Est. 1976
                            </span>
                        </div>
                    </div>
                </Link>

                <div
                    className={`${onPortal ? 'flex' : 'hidden md:flex'} items-center gap-1.5 lg:gap-2 shrink-0 ml-auto`}
                >
                    {/* Show guest actions immediately — don't wait on /api/auth/me */}
                    {!user && (
                        <>
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center px-2.5 lg:px-3 py-2 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors whitespace-nowrap"
                            >
                                Login
                            </Link>
                            <button
                                type="button"
                                onClick={() => setAssociationOpen(true)}
                                className="inline-flex items-center justify-center px-2.5 lg:px-3 py-2 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
                            >
                                Association
                            </button>
                            <Link
                                href="/signup"
                                className="inline-flex items-center justify-center px-3 lg:px-3.5 py-2 rounded-lg text-label-md uppercase tracking-wider bg-primary text-on-primary hover:bg-navy-subtle shadow-sm transition-all whitespace-nowrap"
                            >
                                Sign Up
                            </Link>
                        </>
                    )}

                    {user && (
                        <>
                            {onPortal ? (
                                <Link
                                    href="/"
                                    className="inline-flex items-center justify-center px-2.5 lg:px-3 py-2 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors whitespace-nowrap"
                                >
                                    Landing page
                                </Link>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setAssociationOpen(true)}
                                        className="inline-flex items-center justify-center px-2.5 lg:px-3 py-2 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
                                    >
                                        Association
                                    </button>
                                    <div className="h-5 w-px bg-outline-variant" />
                                    {!user.isAdmin && (
                                        <Link
                                            href="/member"
                                            className="inline-flex items-center justify-center px-2.5 lg:px-3 py-2 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors whitespace-nowrap"
                                        >
                                            Alumni Portal
                                        </Link>
                                    )}
                                    {user.isAdmin && (
                                        <Link
                                            href="/admin"
                                            className="inline-flex items-center justify-center px-2.5 lg:px-3 py-2 rounded-lg text-label-md uppercase tracking-wider bg-primary text-on-primary hover:bg-navy-subtle shadow-sm transition-all whitespace-nowrap"
                                        >
                                            Admin
                                        </Link>
                                    )}
                                </>
                            )}
                            <span
                                className="hidden xl:inline text-label-sm text-on-surface-variant px-2 max-w-[120px] truncate"
                                title={user.email}
                            >
                                {user.email}
                            </span>
                            <button
                                type="button"
                                onClick={() => void handleLogout()}
                                className="inline-flex items-center justify-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-label-md uppercase tracking-wider text-error border border-error/30 hover:bg-error-container transition-colors cursor-pointer whitespace-nowrap"
                                title="Logout"
                            >
                                <span className="material-symbols-outlined text-[18px]">logout</span>
                                Logout
                            </button>
                        </>
                    )}
                </div>

                {!onPortal && (
                <div className="flex md:hidden items-center">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-lg text-primary hover:bg-surface-container transition-colors"
                        aria-label="Toggle Menu"
                    >
                        <span className="material-symbols-outlined text-2xl">
                            {mobileMenuOpen ? 'close' : 'menu'}
                        </span>
                    </button>
                </div>
                )}
            </div>

            {!onPortal && mobileMenuOpen && (
                <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-outline-variant shadow-lg py-4 px-6 flex flex-col gap-3 transition-all">
                    {!user && (
                        <div className="flex flex-col gap-2">
                            <Link
                                href="/login"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors"
                            >
                                Login
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    setAssociationOpen(true);
                                }}
                                className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors"
                            >
                                Association
                            </button>
                            <Link
                                href="/signup"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full inline-flex items-center justify-center px-3.5 py-2.5 rounded-lg text-label-md uppercase tracking-wider bg-primary text-on-primary shadow-sm"
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}
                    {user && (
                        <div className="flex flex-col gap-2 text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    setAssociationOpen(true);
                                }}
                                className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-surface-container transition-colors"
                            >
                                Association
                            </button>
                            {!user.isAdmin && (
                                <Link
                                    href="/member"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-label-md uppercase tracking-wider bg-surface-container text-primary"
                                >
                                    Alumni Portal
                                </Link>
                            )}
                            {user.isAdmin && (
                                <Link
                                    href="/admin"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-label-md uppercase tracking-wider bg-primary text-on-primary"
                                >
                                    Admin
                                </Link>
                            )}
                            <span className="text-label-sm text-on-surface-variant truncate py-1">
                                {user.email}
                            </span>
                            <button
                                type="button"
                                onClick={() => void handleLogout()}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-label-md uppercase tracking-wider text-error bg-error-container/50 hover:bg-error-container transition-colors cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">logout</span>
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            )}

            <AssociationModal open={associationOpen} onClose={() => setAssociationOpen(false)} />
        </header>
    );
}
