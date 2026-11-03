# SFS Alumni Portal — Full New-Account Migration Pack

**This folder is the single handoff package** at the repo root. Zip `migrations/` for guide + schema SQLs + live data INSERTs + env template.

```
migrations/
  README.md              ← this guide
  APPLY_ORDER.md         ← numbered SQL run order
  env.example            ← Vercel / .env.local template
  01_schema/*.sql        ← all schema migrations (filename order)
  02_data/
    full_data_dump.sql   ← live rows (PII; gitignored)
    tables/*.sql         ← same inserts split per table
    optional_users.sql   ← legacy; skip for normal cutover
    dump_summary.json
    README.md
```

`supabase/migrations/*.sql` remains the app’s canonical schema (Supabase CLI). Refresh this pack with:

```bash
node scripts/dump-supabase-inserts.mjs
```

Auth is **table-based** (`public.alumni_accounts` + `AUTH_SECRET`). Alumni do **not** use Supabase Auth users.

---

## 0. Choose mode

| Mode | When | Data |
|------|------|------|
| **A — Greenfield** | Empty new stack | `01_schema` only; optional alumni sheet import |
| **B — Lift live data** | Keep accounts/regs | `01_schema` + `02_data/full_data_dump.sql` + Storage copy |

Do **not** reuse production Razorpay live keys from another merchant.

---

## 1. Accounts to open

1. **Supabase** — new org/project  
2. **Resend** — API key + verified sending domain  
3. **Razorpay** — KYC; start in Test Mode  
4. **Vercel** — new team; import GitHub repo  
5. Keep **GitHub** or transfer ownership  

```bash
openssl rand -base64 32                 # AUTH_SECRET
npx web-push generate-vapid-keys        # VAPID keys
```

Pick a new `GATE_PIN` (≥ 4 characters).

---

## 2. Supabase

### 2.1 Create project

- Region: **Mumbai (`ap-south-1`)** recommended  
- Save DB password  

### 2.2 API keys → env

| Env var | Source |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` (server only) |

### 2.3 Apply schema

SQL Editor: run every file in **`01_schema/`** in filename order (see `APPLY_ORDER.md`).

If bucket inserts fail, create manually:

| Bucket | Public | Limit | MIME |
|--------|--------|-------|------|
| `alumni-memories` | private | 4 MB | jpeg/png/webp |
| `committee-photos` | public | 4 MB | jpeg/png/webp |

### 2.4 Load live data (mode B)

From a machine still pointing `.env.local` at the **old** project:

```bash
node scripts/dump-supabase-inserts.mjs
```

On the **new** project:

1. Schema done  
2. Run `migrations/02_data/full_data_dump.sql`  
3. **Skip** `migrations/02_data/optional_users.sql`  

Dumps contain password hashes + PII (gitignored).

### 2.5 Storage (mode B)

SQL does not move files. Copy `committee-photos` and `alumni-memories` so object keys match DB paths.

### 2.6 First admin (mode A only)

```sql
update public.alumni_accounts
set role = 'admin', member_status = 'verified'
where email = 'YOUR_EMAIL';
```

### 2.7 Optional roster import (mode A)

```bash
node scripts/import-alumni-sheet.mjs
IMPORT_PASSWORD='…' node scripts/import-alumni-sheet.mjs --apply
```

---

## 3. Resend

```env
RESEND_API_KEY=re_...
EMAIL_FROM="SFS Alumni <admin@alumnicorner.org>"
```

Verify the sending domain (SPF/DKIM). Reset links use `NEXT_PUBLIC_APP_URL`.

---

## 4. Razorpay

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...   # same as KEY_ID
```

Webhook (after site URL exists): `https://YOUR_HOST/api/payments/webhook`  
Events: `payment.captured`, `order.paid` → `RAZORPAY_WEBHOOK_SECRET`

Live later: swap all three keys to `rzp_live_`, update webhook, redeploy.

---

## 5. VAPID (Admin broadcast)

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:alumni@sfsshanthinagar.edu
```

New domain/keys → users re-opt-in on `/event-app`.

---

## 6. Vercel

Import repo → set all vars from `env.example` → deploy.

```bash
npx vercel login && npx vercel link && npx vercel --prod
```

Optional aliases (current test stack):

```bash
DEP=<deployment-host>.vercel.app
npx vercel alias set "$DEP" test-sfs-alumni.vercel.app
npx vercel alias set "$DEP" test-sfs-alumni-alpha.vercel.app
npx vercel alias set "$DEP" sfs-alumni-golden-jubilee-alpha.vercel.app
```

Custom domain: add in Vercel → set `NEXT_PUBLIC_APP_URL` → update Razorpay webhook + Resend.

---

## 7. One-sitting order

1. Supabase + `01_schema` + buckets  
2. Mode B: dump → `migrations/02_data/full_data_dump.sql` + Storage  
3. Secrets: `AUTH_SECRET`, VAPID, `GATE_PIN`  
4. Resend + Razorpay test keys  
5. Vercel env + deploy + webhook  
6. Smoke test → later DNS + live Razorpay  

---

## 8. Smoke checklist

Landing → login → `/admin` → events/regs → test payment → reset email → `/gate` → push broadcast → donations.

---

## 9. Env cheat-sheet

See `env.example` in this folder.
