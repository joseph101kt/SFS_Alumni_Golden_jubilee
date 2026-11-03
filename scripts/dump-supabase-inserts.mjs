/**
 * Dump public app tables from the linked Supabase project as INSERT SQL.
 *
 * Usage:  node scripts/dump-supabase-inserts.mjs
 * Reads:  .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * Writes under migrations/02_data/ (repo root):
 *   full_data_dump.sql, tables/*.sql, optional_users.sql, dump_summary.json
 * Also refreshes migrations/01_schema/ from supabase/migrations/*.sql
 *
 * Apply on a NEW project AFTER 01_schema (see migrations/README.md)
 */
import { createClient } from '@supabase/supabase-js';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = path.join(root, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    if (!process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

/** FK-safe insert order for the live app (table-auth). */
const APP_TABLES = [
  'alumni_accounts',
  'event_catalog',
  'donation_causes',
  'event_registrations',
  'donations',
  'alumni_stories',
  'alumni_memories',
  'committee_members',
  'password_reset_tokens',
  'push_subscriptions',
  'event_broadcasts',
];

/** Legacy Supabase-Auth profile table — optional; FK to auth.users. */
const LEGACY_TABLES = ['users'];

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function fetchAll(table) {
  const page = 1000;
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .range(from, from + page - 1);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
  }
  return rows;
}

function insertStatements(table, rows) {
  const out = [];
  if (!rows.length) {
    out.push(`-- ${table}: empty`);
    out.push('');
    return out;
  }
  const cols = Object.keys(rows[0]);
  out.push(`-- ${table}: ${rows.length} rows`);
  const chunkSize = 40;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const slice = rows.slice(index, index + chunkSize);
    out.push(
      `INSERT INTO public.${table} (${cols.map((col) => `"${col}"`).join(', ')}) VALUES`
    );
    slice.forEach((row, sliceIndex) => {
      const values = cols.map((col) => sqlLiteral(row[col])).join(', ');
      const end = sliceIndex === slice.length - 1 ? ';' : ',';
      out.push(`  (${values})${end}`);
    });
  }
  out.push('');
  return out;
}

const packDir = path.join(root, 'migrations');
const schemaDir = path.join(packDir, '01_schema');
const outDir = path.join(packDir, '02_data');
const tablesDir = path.join(outDir, 'tables');
mkdirSync(schemaDir, { recursive: true });
mkdirSync(tablesDir, { recursive: true });

const migrationsDir = path.join(root, 'supabase', 'migrations');
for (const name of readdirSync(migrationsDir)) {
  if (!name.endsWith('.sql')) continue;
  copyFileSync(path.join(migrationsDir, name), path.join(schemaDir, name));
}
console.log(`Refreshed ${schemaDir}`);

const summary = [];
const cache = new Map();

for (const table of [...APP_TABLES, ...LEGACY_TABLES]) {
  try {
    const rows = await fetchAll(table);
    cache.set(table, rows);
    summary.push({ table, count: rows.length, skipped: false });
    console.log(`${table}: ${rows.length}`);
  } catch (error) {
    console.log(`SKIP ${table}: ${error.message}`);
    summary.push({ table, count: 0, skipped: true, error: error.message });
  }
}

const header = [
  '-- Auto-generated FULL DATA dump for SFS Alumni portal',
  `-- Generated: ${new Date().toISOString()}`,
  '-- Apply AFTER migrations/01_schema/*.sql',
  '-- Contains password_hash + PII. Keep private; do not push to public remotes.',
  '',
];

const main = [...header];
main.push('BEGIN;');
main.push('');
main.push('-- Clear children before parents (reverse FK order)');
for (const table of [...APP_TABLES].reverse()) {
  const meta = summary.find((row) => row.table === table);
  if (!meta || meta.skipped) continue;
  main.push(`DELETE FROM public.${table};`);
}
main.push('');

let fileIndex = 1;
for (const table of APP_TABLES) {
  const meta = summary.find((row) => row.table === table);
  const prefix = String(fileIndex).padStart(2, '0');
  fileIndex += 1;

  if (!meta || meta.skipped) {
    main.push(`-- SKIPPED ${table}: ${meta?.error || 'n/a'}`);
    main.push('');
    writeFileSync(
      path.join(tablesDir, `${prefix}_${table}.sql`),
      `-- SKIPPED ${table}: ${meta?.error || 'n/a'}\n`
    );
    continue;
  }

  const rows = cache.get(table) || [];
  const stmts = insertStatements(table, rows);
  main.push(...stmts);

  const perTable = [
    `-- public.${table}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Rows: ${rows.length}`,
    '',
    ...stmts,
  ];
  writeFileSync(path.join(tablesDir, `${prefix}_${table}.sql`), perTable.join('\n'));
}

main.push('COMMIT;');
main.push('');

writeFileSync(path.join(outDir, 'full_data_dump.sql'), main.join('\n'));

const usersRows = cache.get('users') || [];
const usersMeta = summary.find((row) => row.table === 'users');
const usersSql = [
  '-- OPTIONAL / LEGACY: public.users',
  '-- This table FKs to auth.users(id). The live portal uses alumni_accounts instead.',
  '-- Only run if you also recreate matching auth.users rows in the new project.',
  `-- Generated: ${new Date().toISOString()}`,
  usersMeta?.skipped ? `-- SKIPPED: ${usersMeta.error}` : `-- Rows: ${usersRows.length}`,
  '',
  ...(usersMeta?.skipped ? [] : insertStatements('users', usersRows)),
].join('\n');
writeFileSync(path.join(outDir, 'optional_users.sql'), usersSql);

writeFileSync(path.join(outDir, 'dump_summary.json'), JSON.stringify(summary, null, 2));
console.log(`Wrote ${path.join(outDir, 'full_data_dump.sql')}`);
console.log(`Wrote ${tablesDir}/*.sql`);
console.log(`Wrote ${path.join(outDir, 'optional_users.sql')}`);
