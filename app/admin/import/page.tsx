'use client';

import { FormEvent, useMemo, useRef, useState, type ChangeEvent } from 'react';
import AdminShell from '@/components/admin-shell';

type Line = {
  name: string;
  email: string;
  username: string;
  status: 'create' | 'existing' | 'duplicate' | 'failed' | 'skipped';
};

const STATUS_LABEL: Record<Line['status'], string> = {
  create: 'Created',
  existing: 'Already registered',
  duplicate: 'Repeated email',
  failed: 'Not saved',
  skipped: 'Skipped',
};

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function AdminImportPage() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lines, setLines] = useState<Line[] | null>(null);
  const [created, setCreated] = useState(0);
  const [query, setQuery] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const reupload = useRef(false);
  const inFlight = useRef(false);

  const visible = useMemo(() => {
    if (!lines) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((line) =>
      `${line.name} ${line.username} ${line.email}`.toLowerCase().includes(needle)
    );
  }, [lines, query]);

  async function upload(file: File) {
    if (inFlight.current) return;
    if (password.length < 8) {
      setMessage('Enter a password of at least 8 characters, then choose the workbook again.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('password', password);
      const res = await fetch('/api/admin/import', { method: 'POST', body });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Could not import the workbook.');
        return;
      }
      setCreated(Number(payload.created) || 0);
      setLines(payload.lines as Line[]);
      setQuery('');
    } finally {
      inFlight.current = false;
      setBusy(false);
      setFileKey((key) => key + 1);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = (event.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
    if (!file) {
      setMessage('Choose the alumni workbook.');
      return;
    }
    void upload(file);
  }

  function download() {
    if (!lines) return;
    const header = ['Name', 'Username', 'Email', 'Result'];
    const body = lines.map((line) =>
      [line.name, line.username, line.email, STATUS_LABEL[line.status] || line.status].map(csvCell).join(',')
    );
    const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alumni-usernames.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title="Import alumni">
      <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
        <p className="text-body-sm text-navy-subtle">
          Upload the alumni workbook, including a second time. New people are saved with the password
          below. People who already have an account keep their username and password. The username
          for each person is listed after every upload.
        </p>
        <label className="block" htmlFor="workbook">
          <span className="block text-label-sm uppercase tracking-wider text-primary mb-2">
            Alumni workbook
          </span>
          <input
            key={fileKey}
            id="workbook"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const picked = event.target.files?.[0];
              if (!picked || !reupload.current) return;
              reupload.current = false;
              void upload(picked);
            }}
            className="block w-full text-body-sm text-navy-subtle file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-label-sm file:text-on-primary file:cursor-pointer"
          />
        </label>
        <label className="block" htmlFor="new-password">
          <span className="block text-label-sm uppercase tracking-wider text-primary mb-2">
            Password for new accounts
          </span>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full px-4 py-3.5 rounded-lg border border-primary/15 text-body-md bg-surface-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-jubilee-gold-deep"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary text-on-primary px-5 py-3 text-label-md uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? 'Uploading…' : 'Upload and assign usernames'}
        </button>
      </form>

      {message && (
        <p role="alert" className="mt-5 rounded-xl border border-error/30 bg-error-container p-4 text-body-sm text-error max-w-2xl">
          {message}
        </p>
      )}

      {lines && (
        <section className="mt-8" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h3 className="text-headline-sm text-primary">Usernames</h3>
              <p className="text-body-sm text-navy-subtle mt-1">
                {created} created. {lines.length} people in the workbook.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  reupload.current = true;
                  const input = document.getElementById('workbook');
                  input?.scrollIntoView({ block: 'center' });
                  input?.click();
                }}
                className="rounded-lg bg-primary text-on-primary px-3 py-2 text-label-sm cursor-pointer hover:bg-primary-container"
              >
                Upload another workbook
              </button>
              <button
                type="button"
                onClick={download}
                className="rounded-lg border border-primary/20 bg-surface-ivory px-3 py-2 text-label-sm text-primary cursor-pointer hover:bg-secondary-container/30"
              >
                Download CSV
              </button>
            </div>
          </div>
          <label className="block max-w-md mb-4" htmlFor="find-person">
            <span className="sr-only">Find a person</span>
            <input
              id="find-person"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a person"
              className="w-full px-4 py-3.5 rounded-lg border border-primary/15 text-body-sm bg-surface-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-jubilee-gold-deep"
            />
          </label>
          <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-surface-paper shadow-sm">
            <table className="min-w-full text-left text-body-sm">
              <caption className="sr-only">Username assigned to each person in the workbook</caption>
              <thead className="bg-primary text-label-sm text-secondary-container">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Username</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-navy-subtle">
                      No one matches that search.
                    </td>
                  </tr>
                ) : (
                  visible.map((line, index) => (
                    <tr key={`${line.email}-${line.name}-${index}`} className="border-t border-primary/10">
                      <td className="px-4 py-3">{line.name}</td>
                      <td className="px-4 py-3 font-medium text-primary">{line.username || '—'}</td>
                      <td className="px-4 py-3 text-navy-subtle">{line.email || '—'}</td>
                      <td className="px-4 py-3">{STATUS_LABEL[line.status] || line.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
