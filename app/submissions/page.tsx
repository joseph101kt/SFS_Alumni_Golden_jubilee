'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import MemberGate from '@/components/member-gate';
import PortalShell from '@/components/portal-shell';

type MemoryRow = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  batch_year?: number | null;
  batch_label?: string | null;
  status: string;
  review_note?: string | null;
  created_at?: string;
};

type StoryRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  review_note?: string | null;
  created_at?: string;
};

export default function SubmissionsPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [message, setMessage] = useState('Loading your submissions…');
  const [batchDefault, setBatchDefault] = useState('');
  const [memoryError, setMemoryError] = useState('');
  const [memoryOk, setMemoryOk] = useState('');
  const [storyError, setStoryError] = useState('');
  const [storyOk, setStoryOk] = useState('');
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [memoryFileName, setMemoryFileName] = useState('');

  async function loadAll() {
    const [memRes, storyRes] = await Promise.all([
      fetch('/api/memories/mine', { cache: 'no-store' }),
      fetch('/api/stories/mine', { cache: 'no-store' }),
    ]);
    if (!memRes.ok && !storyRes.ok) {
      setMessage('Could not load your submissions.');
      return;
    }
    if (memRes.ok) {
      const data = await memRes.json();
      setMemories(data.submissions || []);
    }
    if (storyRes.ok) {
      const data = await storyRes.json();
      setStories(data.submissions || []);
    }
    setMessage('');
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (meRes.ok) {
          const me = await meRes.json();
          if (active && me.batch != null) setBatchDefault(String(me.batch));
        }
        if (!active) return;
        await loadAll();
      } catch {
        if (active) setMessage('Could not load your submissions.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onShareMemory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMemoryError('');
    setMemoryOk('');
    setMemoryBusy(true);
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      if (fd.get('consent') !== 'on' && fd.get('consent') !== 'true') {
        setMemoryError('Consent is required to share a memory');
        return;
      }
      const image = fd.get('image');
      if (image instanceof File && image.size > 4_000_000) {
        setMemoryError('Image must be 4 MB or smaller');
        return;
      }
      fd.set('consent', 'true');
      const res = await fetch('/api/memories', { method: 'POST', body: fd });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMemoryError(payload.error || 'Could not submit');
        return;
      }
      setMemoryOk('Photo submitted for committee review.');
      form.reset();
      setMemoryFileName('');
      if (batchDefault) {
        const batchSelect = form.elements.namedItem('batch_year') as HTMLSelectElement | null;
        if (batchSelect) batchSelect.value = batchDefault;
      }
      await loadAll();
    } catch {
      setMemoryError('Could not submit');
    } finally {
      setMemoryBusy(false);
    }
  }

  async function onShareStory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStoryError('');
    setStoryOk('');
    setStoryBusy(true);
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fd.get('title'),
          body: fd.get('body'),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStoryError(payload.error || 'Could not submit');
        return;
      }
      setStoryOk('Story submitted for committee review.');
      form.reset();
      await loadAll();
    } catch {
      setStoryError('Could not submit');
    } finally {
      setStoryBusy(false);
    }
  }

  return (
    <PortalShell
      title="My submissions"
      eyebrow="YOUR CONTRIBUTIONS"
      intro="Share a memory photo or a written story for review, then track status here."
    >
      <MemberGate>
        <section id="share" className="mb-10 scroll-mt-32">
          <h2 className="text-headline-sm text-primary mb-3">Share a memory</h2>
          <form
            onSubmit={onShareMemory}
            className="rounded-2xl border border-outline-variant bg-surface-paper p-5 sm:p-6 space-y-4 max-w-2xl"
          >
            <div>
              <span className="text-label-sm text-primary block mb-1">Photo</span>
              <input
                id="memory-photo"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                disabled={memoryBusy}
                className="sr-only"
                onChange={(e) => setMemoryFileName(e.target.files?.[0]?.name || '')}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="memory-photo"
                  className={`inline-flex items-center justify-center rounded-lg bg-primary text-on-primary px-4 py-2.5 text-label-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container ${
                    memoryBusy ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {memoryFileName ? 'Replace photo' : 'Upload photo'}
                </label>
                <span className="text-body-sm text-on-surface-variant truncate max-w-[14rem]">
                  {memoryFileName || 'JPEG, PNG or WebP · max 4 MB'}
                </span>
              </div>
            </div>
            <label className="block">
              <span className="text-label-sm text-primary">Title</span>
              <input
                name="title"
                required
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-outline-variant px-4 py-3.5 text-body-sm bg-surface"
              />
            </label>
            <label className="block">
              <span className="text-label-sm text-primary">Caption (optional)</span>
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-outline-variant px-4 py-3.5 text-body-sm bg-surface"
              />
            </label>
            <label className="block">
              <span className="text-label-sm text-primary">Batch</span>
              <select
                name="batch_year"
                defaultValue={batchDefault || 'general'}
                key={batchDefault || 'general'}
                className="mt-1 w-full rounded-lg border border-outline-variant px-4 py-3.5 text-body-sm bg-surface"
              >
                <option value="general">General / all SFS</option>
                {batchDefault && <option value={batchDefault}>{batchDefault} (your batch)</option>}
                {Array.from({ length: 51 }, (_, i) => 1976 + i)
                  .filter((y) => String(y) !== batchDefault)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex items-start gap-2 text-body-sm text-on-surface-variant">
              <input name="consent" type="checkbox" required className="mt-1" />
              <span>
                I have the right to share this and agree the committee may publish it in the alumni
                archive.
              </span>
            </label>
            {memoryError && <p className="text-body-sm text-error">{memoryError}</p>}
            {memoryOk && <p className="text-body-sm text-primary">{memoryOk}</p>}
            <button
              type="submit"
              disabled={memoryBusy}
              className="rounded-full bg-primary text-on-primary px-5 py-2.5 text-label-sm font-bold disabled:opacity-60 cursor-pointer"
            >
              {memoryBusy ? 'Submitting…' : 'Submit photo for review'}
            </button>
          </form>
        </section>

        <section id="share-story" className="mb-10 scroll-mt-32">
          <h2 className="text-headline-sm text-primary mb-3">Share a story</h2>
          <form
            onSubmit={onShareStory}
            className="rounded-2xl border border-outline-variant bg-surface-paper p-5 sm:p-6 space-y-4 max-w-2xl"
          >
            <label className="block">
              <span className="text-label-sm text-primary">Title</span>
              <input
                name="title"
                required
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-outline-variant px-4 py-3.5 text-body-sm bg-surface"
              />
            </label>
            <label className="block">
              <span className="text-label-sm text-primary">Your story</span>
              <textarea
                name="body"
                required
                rows={8}
                maxLength={5000}
                placeholder="A memory, a teacher, a moment that still stays with you…"
                className="mt-1 w-full rounded-lg border border-outline-variant px-4 py-3.5 text-body-sm bg-surface"
              />
            </label>
            {storyError && <p className="text-body-sm text-error">{storyError}</p>}
            {storyOk && <p className="text-body-sm text-primary">{storyOk}</p>}
            <button
              type="submit"
              disabled={storyBusy}
              className="rounded-full bg-primary text-on-primary px-5 py-2.5 text-label-sm font-bold disabled:opacity-60 cursor-pointer"
            >
              {storyBusy ? 'Submitting…' : 'Submit story for review'}
            </button>
          </form>
        </section>

        {message && (
          <p className="rounded-xl bg-white border border-outline-variant p-5 text-body-sm text-on-surface-variant mb-6">
            {message}
          </p>
        )}

        <h2 className="text-headline-sm text-primary mb-3">Your memory photos</h2>
        {!message && !memories.length ? (
          <p className="text-body-sm text-on-surface-variant mb-8">No photo submissions yet.</p>
        ) : (
          <ul className="space-y-3 mb-10">
            {memories.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-outline-variant bg-white overflow-hidden flex flex-col sm:flex-row"
              >
                {m.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="sm:w-36 h-28 object-cover shrink-0 bg-primary/5"
                  />
                ) : (
                  <div className="sm:w-36 h-28 bg-primary/5 grid place-items-center shrink-0">
                    <span className="material-symbols-outlined text-3xl text-primary">photo</span>
                  </div>
                )}
                <div className="p-4 flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                  <span
                    className={`text-label-sm uppercase tracking-wider font-bold ${
                      m.status === 'published'
                        ? 'text-jubilee-gold-deep'
                        : m.status === 'rejected'
                          ? 'text-error'
                          : 'text-on-surface-variant'
                    }`}
                  >
                    {m.status}
                  </span>
                  <span className="text-body-sm text-primary font-medium">{m.title}</span>
                  {(m.batch_label || m.batch_year != null) && (
                    <span className="text-label-sm text-jubilee-gold-deep">
                      {m.batch_label || m.batch_year}
                    </span>
                  )}
                  {m.created_at && (
                    <span className="text-body-sm text-on-surface-variant">
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  )}
                  {m.review_note && m.status === 'rejected' && (
                    <span className="text-body-sm text-on-surface-variant w-full">
                      Note: {m.review_note}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <h2 className="text-headline-sm text-primary mb-3">Your stories</h2>
        {!message && !stories.length ? (
          <p className="text-body-sm text-on-surface-variant">No story submissions yet.</p>
        ) : (
          <ul className="divide-y divide-outline-variant border-t border-outline-variant">
            {stories.map((s) => (
              <li key={s.id} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`text-label-sm uppercase tracking-wider font-bold ${
                      s.status === 'published'
                        ? 'text-jubilee-gold-deep'
                        : s.status === 'rejected'
                          ? 'text-error'
                          : 'text-on-surface-variant'
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="text-body-sm text-primary font-medium">{s.title}</span>
                  {s.created_at && (
                    <span className="text-body-sm text-on-surface-variant">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {s.review_note && s.status === 'rejected' && (
                  <p className="text-body-sm text-on-surface-variant mt-1">Note: {s.review_note}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-body-sm text-on-surface-variant">
          Browse published work in{' '}
          <Link href="/memories" className="text-primary font-bold underline underline-offset-2">
            Memories
          </Link>{' '}
          and{' '}
          <Link href="/stories" className="text-primary font-bold underline underline-offset-2">
            Stories
          </Link>
          .
        </p>
      </MemberGate>
    </PortalShell>
  );
}
