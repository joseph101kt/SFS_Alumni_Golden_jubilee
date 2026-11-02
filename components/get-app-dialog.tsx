'use client';

import { useEffect, useId, useRef } from 'react';
import PwaInstall from '@/components/pwa-install';

export default function GetAppDialog({
  open,
  onClose,
  startPath = '/event-app',
  appLabel = 'SFS Jubilee',
  eyebrow = 'Event app',
  title = 'Get the app',
}: {
  open: boolean;
  onClose: () => void;
  startPath?: string;
  appLabel?: string;
  eyebrow?: string;
  title?: string;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-primary/50 backdrop-blur-[2px] cursor-pointer"
        aria-label="Close get the app dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[81] w-full sm:max-w-lg max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-surface-paper border border-outline-variant shadow-xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-outline-variant">
          <div>
            <p className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
              {eyebrow}
            </p>
            <h2 id={titleId} className="text-headline-sm text-primary mt-1">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-primary hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          <PwaInstall key={startPath} shareMode startPath={startPath} appLabel={appLabel} />
        </div>
      </div>
    </div>
  );
}
