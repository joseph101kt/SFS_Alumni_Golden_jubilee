'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import JubileeRegisterLink from '@/components/jubilee-register-link';
import { registrationPath } from '@/lib/events/choose-event';
import { heroEventCopy } from '@/lib/events/hero-copy';
import type { EventCatalog } from '@/lib/events/types';

const FALLBACK = {
  id: 'fallback',
  eyebrow: 'Celebrating 50 Years • 1976 – 2026',
  title: 'Golden Jubilee & Alumni Homecoming',
  body: 'Honoring 50 glorious years of transformational education, enduring memories, and fraternal unity at SFS Shanthinagar. Calling all alumni, revered faculty, and students to reunite.',
  meta: '',
};

const registerClass =
  'inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-secondary-container hover:bg-secondary-fixed-dim text-on-secondary-fixed text-label-md uppercase tracking-wider shadow-lg hover:shadow-xl transition-all';

export default function Hero() {
  const [events, setEvents] = useState<EventCatalog[]>([]);
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        if (!active || !res.ok) return;
        const rows = (await res.json()) as EventCatalog[];
        if (active && Array.isArray(rows)) setEvents(rows);
      } catch {
        if (active) setEvents([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const target = useRef<number | null>(null);

  function go(delta: number) {
    const el = scroller.current;
    if (!el || events.length < 2 || el.clientWidth === 0) return;
    const current = Math.round(el.scrollLeft / el.clientWidth);
    const i = (current + delta + events.length) % events.length;
    target.current = i;
    setIndex(i);
  }

  useEffect(() => {
    const el = scroller.current;
    if (!el || target.current == null) return;
    const i = target.current;
    target.current = null;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'auto' });
  }, [index]);

  function onScroll() {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  const slides = events.length ? events.map((event) => ({ id: event.id, ...heroEventCopy(event) })) : [FALLBACK];

  return (
    <section className="relative w-full h-[620px] lg:h-[700px] overflow-hidden -mt-20">
      <div className="absolute inset-0 overflow-hidden">
        <img
          alt="St. Francis de Sales High School Building Campus"
          className="w-full h-full object-cover object-center sm:object-right transform scale-105"
          src="/images/assembly.jpg"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-primary/40 sm:bg-gradient-to-r sm:from-primary sm:via-primary/50 sm:to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent"></div>

      <div className="absolute inset-0 max-w-7xl mx-auto px-6 lg:px-12 flex flex-col justify-end pb-12 lg:pb-16 pt-24">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="grid w-full min-w-0 max-w-3xl grid-flow-col auto-cols-[100%] overflow-x-auto snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-roledescription={events.length > 1 ? 'carousel' : undefined}
          aria-label={events.length > 1 ? 'Open events' : undefined}
        >
          {slides.map((slide) => (
            <div key={slide.id} className="snap-start">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-container/90 border border-secondary-container/40 backdrop-blur-md shadow-md mb-4 max-w-full">
                <span className="w-2 h-2 rounded-full bg-secondary-container shrink-0"></span>
                <span className="text-label-sm uppercase tracking-widest text-secondary-fixed">
                  {slide.eyebrow}
                </span>
              </div>
              <h1 className="text-headline-lg lg:text-display-xl text-surface-paper tracking-tight leading-tight mb-4 drop-shadow-md">
                {slide.title}
              </h1>
              {slide.body ? (
                <p className="text-body-md lg:text-body-lg text-surface-container-high leading-relaxed mb-3 max-w-2xl line-clamp-4">
                  {slide.body}
                </p>
              ) : null}
              {slide.meta ? (
                <p className="text-label-sm uppercase tracking-widest text-secondary-fixed mb-8">{slide.meta}</p>
              ) : (
                <div className="mb-8" />
              )}
              <div className="flex flex-wrap items-center gap-4">
                {slide.id === 'fallback' ? (
                  <JubileeRegisterLink variant="hero" />
                ) : (
                  <Link href={registrationPath(slide.id)} className={registerClass}>
                    <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                    Register
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {events.length > 1 ? (
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              className="h-11 w-11 rounded-full border border-secondary-container/50 text-surface-paper hover:bg-primary-container/80"
              aria-label="Previous event"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="h-11 w-11 rounded-full border border-secondary-container/50 text-surface-paper hover:bg-primary-container/80"
              aria-label="Next event"
              onClick={() => go(1)}
            >
              ›
            </button>
            <p className="text-label-sm text-surface-container-high" aria-live="polite">
              {index + 1} of {events.length}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
