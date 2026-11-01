'use client';

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import AdminShell from '@/components/admin-shell';

type Member = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  batch: number;
  phone_number: string | null;
  bio: string | null;
  photo_url: string | null;
  sort_order: number;
  published: boolean;
};

const emptyForm = {
  full_name: '',
  role: '',
  email: '',
  batch: '',
  phone_number: '',
  bio: '',
  sort_order: '0',
  published: true,
};

export default function AdminCommitteePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/committee', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not load');
        return;
      }
      setMembers(payload.members || []);
    } catch {
      setError('Could not load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(m: Member) {
    setEditingId(m.id);
    setForm({
      full_name: m.full_name,
      role: m.role,
      email: m.email,
      batch: String(m.batch),
      phone_number: m.phone_number || '',
      bio: m.bio || '',
      sort_order: String(m.sort_order),
      published: m.published,
    });
    setPhoto(null);
    setClearPhoto(false);
    setOk('');
    setError('');
    // Bring the edit form into view (easy to miss on small screens).
    requestAnimationFrame(() => {
      document.getElementById('committee-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPhoto(null);
    setClearPhoto(false);
    setOk('');
    setError('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const url = editingId ? `/api/admin/committee/${editingId}` : '/api/admin/committee';
      let res: Response;

      if (photo || (editingId && clearPhoto)) {
        const body = new FormData();
        body.set('full_name', form.full_name);
        body.set('role', form.role);
        body.set('email', form.email);
        body.set('batch', form.batch);
        body.set('phone_number', form.phone_number);
        body.set('bio', form.bio);
        body.set('sort_order', form.sort_order);
        body.set('published', form.published ? 'true' : 'false');
        if (photo) body.set('photo', photo);
        if (clearPhoto) body.set('clear_photo', 'true');
        // POST for updates too — multipart PATCH is flaky in some environments.
        res = await fetch(url, { method: 'POST', body });
      } else if (editingId) {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...form,
            published: form.published,
            clear_photo: false,
          }),
        });
      } else {
        const body = new FormData();
        body.set('full_name', form.full_name);
        body.set('role', form.role);
        body.set('email', form.email);
        body.set('batch', form.batch);
        body.set('phone_number', form.phone_number);
        body.set('bio', form.bio);
        body.set('sort_order', form.sort_order);
        body.set('published', form.published ? 'true' : 'false');
        res = await fetch(url, { method: 'POST', body });
      }

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Save failed');
        return;
      }
      setOk(
        editingId
          ? 'Updated.'
          : form.published
            ? 'Added and published — visible under Association.'
            : 'Added as draft — tick Published to show under Association.'
      );
      startCreate();
      await load();
    } catch {
      setError('Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${name} from the committee list?`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/committee/${id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Delete failed');
        return;
      }
      if (editingId === id) startCreate();
      await load();
    } catch {
      setError('Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Committee">
      <p className="text-body-sm text-on-surface-variant mb-6 max-w-3xl">
        Maintain alumni committee members shown on the landing page and About the association.
        Toggle <strong>Published</strong> when ready for the public site.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <form
          id="committee-form"
          onSubmit={onSubmit}
          className="rounded-2xl border border-outline-variant bg-white p-5 space-y-3 h-fit"
        >
          <h3 className="text-headline-sm text-primary mb-2">
            {editingId ? 'Edit member' : 'Add member'}
          </h3>
          <p className="text-body-sm text-on-surface-variant -mt-1 mb-1">
            Keep <strong>Published</strong> checked so they appear in the Association popup.
          </p>
          <Field label="Name" htmlFor="cm-name">
            <input
              id="cm-name"
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className={inputClass}
              disabled={busy}
            />
          </Field>
          <Field label="Role" htmlFor="cm-role">
            <input
              id="cm-role"
              required
              placeholder="President, Secretary…"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className={inputClass}
              disabled={busy}
            />
          </Field>
          <Field label="Email" htmlFor="cm-email">
            <input
              id="cm-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
              disabled={busy}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Batch year" htmlFor="cm-batch">
              <input
                id="cm-batch"
                required
                inputMode="numeric"
                value={form.batch}
                onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))}
                className={inputClass}
                disabled={busy}
              />
            </Field>
            <Field label="Sort order" htmlFor="cm-sort">
              <input
                id="cm-sort"
                inputMode="numeric"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                className={inputClass}
                disabled={busy}
              />
            </Field>
          </div>
          <Field label="Phone (optional)" htmlFor="cm-phone">
            <input
              id="cm-phone"
              value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              className={inputClass}
              disabled={busy}
            />
          </Field>
          <Field label="Short bio (optional)" htmlFor="cm-bio">
            <textarea
              id="cm-bio"
              rows={3}
              maxLength={280}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              className={`${inputClass} resize-y min-h-[5rem]`}
              disabled={busy}
              placeholder="One or two lines about this officer"
            />
            <p className="text-body-sm text-on-surface-variant mt-1">
              {form.bio.length}/280
            </p>
          </Field>
          <div>
            <span className="text-label-sm uppercase tracking-wider text-primary block mb-1">
              Photo
            </span>
            <input
              id="cm-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                setPhoto(e.target.files?.[0] || null);
                setClearPhoto(false);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="cm-photo"
                className={`inline-flex items-center justify-center rounded-lg border border-outline-variant bg-white px-4 py-2.5 text-label-sm font-bold uppercase tracking-wider text-primary cursor-pointer hover:bg-surface-container ${
                  busy ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {photo || editingId ? 'Replace photo' : 'Upload photo'}
              </label>
              <span className="text-body-sm text-on-surface-variant truncate max-w-[14rem]">
                {photo ? photo.name : 'JPEG, PNG, or WebP · max 4 MB'}
              </span>
            </div>
          </div>
          {editingId && (
            <label className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={clearPhoto}
                onChange={(e) => setClearPhoto(e.target.checked)}
                disabled={busy || Boolean(photo)}
              />
              Remove current photo
            </label>
          )}
          <label className="flex items-center gap-2 text-body-sm text-primary font-medium">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              disabled={busy}
            />
            Published on public site
          </label>

          {error && (
            <p className="rounded-lg bg-error-container text-error text-body-sm p-3">{error}</p>
          )}
          {ok && (
            <p className="rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm p-3">
              {ok}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary text-on-primary px-4 py-2.5 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add member'}
            </button>
            {editingId && (
              <button
                type="button"
                disabled={busy}
                onClick={startCreate}
                className="rounded-lg border border-outline-variant px-4 py-2.5 text-label-sm uppercase tracking-wider"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div>
          <h3 className="text-headline-sm text-primary mb-3">Directory ({members.length})</h3>
          {!members.length ? (
            <p className="text-body-sm text-on-surface-variant">No members yet.</p>
          ) : (
            <ul className="space-y-3">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-outline-variant bg-white p-3 flex gap-3 items-start"
                >
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo_url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-primary/5 grid place-items-center shrink-0 text-primary text-label-md font-bold">
                      {m.full_name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-label-sm text-jubilee-gold-deep uppercase tracking-wider">
                      {m.role}
                      {!m.published && (
                        <span className="ml-2 text-on-surface-variant normal-case tracking-normal">
                          · draft
                        </span>
                      )}
                    </p>
                    <p className="text-body-md text-primary font-semibold">{m.full_name}</p>
                    {m.bio ? (
                      <p className="text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
                        {m.bio}
                      </p>
                    ) : null}
                    <p className="text-body-sm text-on-surface-variant truncate">
                      Batch {m.batch} · {m.email}
                      {m.phone_number ? ` · ${m.phone_number}` : ''}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(m)}
                        className="text-label-sm text-primary underline underline-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDelete(m.id, m.full_name)}
                        className="text-label-sm text-error underline underline-offset-2"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

const inputClass =
  'w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-label-sm uppercase tracking-wider text-primary block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
