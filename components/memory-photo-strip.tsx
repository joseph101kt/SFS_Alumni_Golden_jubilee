'use client';

import { useEffect, useRef, useState } from 'react';

export type MemoryCardItem = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  batch_year?: number | null;
  batch_label?: string | null;
};

const INTERVAL_MS = 4500;
const STACK_DEPTH = 3;
const EXIT_MS = 420;

export default function MemoryPhotoStrip({
  items,
  label,
  emptyText,
}: {
  items: MemoryCardItem[];
  label: string;
  emptyText: string;
}) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [exitDir, setExitDir] = useState<'next' | 'prev' | null>(null);
  const busyRef = useRef(false);
  const paused = userPaused || hoverPaused;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    setIndex(0);
    setExitDir(null);
    busyRef.current = false;
  }, [items]);

  function go(delta: number) {
    if (items.length <= 1 || busyRef.current) return;
    if (reduceMotion) {
      setIndex((i) => (i + delta + items.length) % items.length);
      return;
    }
    busyRef.current = true;
    setExitDir(delta > 0 ? 'next' : 'prev');
    window.setTimeout(() => {
      setIndex((i) => (i + delta + items.length) % items.length);
      setExitDir(null);
      busyRef.current = false;
    }, EXIT_MS);
  }

  useEffect(() => {
    if (reduceMotion || paused || items.length <= 1) return;
    const id = window.setInterval(() => go(1), INTERVAL_MS);
    return () => window.clearInterval(id);
    // go reads latest via closure each effect run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, paused, items.length, index]);

  if (!items.length) {
    return (
      <section className="mb-10">
        <h2 className="text-headline-sm text-primary mb-3">{label}</h2>
        <p className="rounded-xl border border-outline-variant bg-white p-5 text-body-sm text-on-surface-variant">
          {emptyText}
        </p>
      </section>
    );
  }

  const front = items[index];
  const stack = Array.from({ length: Math.min(STACK_DEPTH, items.length) }, (_, depth) => {
    const itemIndex = (index + depth) % items.length;
    return { item: items[itemIndex], depth, itemIndex };
  });

  return (
    <section
      className="mb-10"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoverPaused(false);
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-headline-sm text-primary">{label}</h2>
        {items.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous memory"
              className="rounded-lg border border-outline-variant px-2 py-1 text-primary hover:bg-secondary-container"
              onClick={() => go(-1)}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              type="button"
              aria-label={userPaused || reduceMotion ? 'Play carousel' : 'Pause carousel'}
              className="rounded-lg border border-outline-variant px-2 py-1 text-primary hover:bg-secondary-container"
              onClick={() => setUserPaused((p) => !p)}
              disabled={reduceMotion}
            >
              <span className="material-symbols-outlined text-[20px]">
                {userPaused || reduceMotion ? 'play_arrow' : 'pause'}
              </span>
            </button>
            <button
              type="button"
              aria-label="Next memory"
              className="rounded-lg border border-outline-variant px-2 py-1 text-primary hover:bg-secondary-container"
              onClick={() => go(1)}
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      <div className="relative mx-auto w-full max-w-lg" style={{ perspective: '1200px' }}>
        <div className="relative h-[320px] sm:h-[360px]">
          {stack
            .slice()
            .reverse()
            .map(({ item, depth, itemIndex }) => {
              const isFront = depth === 0;
              const exiting = isFront && exitDir != null && !reduceMotion;
              const scale = 1 - depth * 0.05;
              const y = depth * 14;
              const rot = depth === 0 ? 0 : depth % 2 === 0 ? -3 : 3;
              const z = 30 - depth;

              let transform = `translateY(${y}px) scale(${scale}) rotate(${rot}deg)`;
              let opacity = 1 - depth * 0.12;
              if (exiting) {
                const x = exitDir === 'next' ? 118 : -118;
                const spin = exitDir === 'next' ? 18 : -18;
                transform = `translate(${x}%, -12%) rotate(${spin}deg) scale(0.92)`;
                opacity = 0;
              }

              return (
                <article
                  key={`${item.id}-${itemIndex}-${depth}`}
                  aria-hidden={!isFront}
                  className="absolute inset-x-0 top-0 mx-auto w-[min(100%,300px)] overflow-hidden border border-outline-variant bg-white shadow-[0_12px_28px_rgba(0,22,40,0.12)]"
                  style={{
                    zIndex: z,
                    transform,
                    opacity,
                    transition: reduceMotion
                      ? undefined
                      : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 380ms ease',
                    transformOrigin: '50% 100%',
                  }}
                >
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={isFront ? item.title : ''}
                      referrerPolicy="no-referrer"
                      className="h-52 sm:h-60 w-full object-cover bg-primary/5"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-52 sm:h-60 grid place-items-center bg-primary/5 text-primary">
                      <span className="material-symbols-outlined text-5xl">photo_library</span>
                    </div>
                  )}
                  <div className="p-4">
                    {(item.batch_label || item.batch_year != null) && (
                      <p className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep">
                        {item.batch_label || item.batch_year}
                      </p>
                    )}
                    <h3 className="text-headline-sm text-primary mt-1 line-clamp-1">{item.title}</h3>
                    {item.description && (
                      <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
        <p className="sr-only" aria-live="polite">
          Showing {index + 1} of {items.length}: {front.title}
        </p>
        {items.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
            {items.map((m, i) => (
              <span
                key={m.id}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === index ? 'bg-jubilee-gold-deep' : 'bg-outline-variant'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
