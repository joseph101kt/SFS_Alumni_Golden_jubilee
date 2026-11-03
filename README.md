# SFS Alumni Golden Jubilee

Alumni portal for **St. Francis de Sales High School, Shanthinagar, Secunderabad** — built for the **Golden Jubilee (1976–2026)** homecoming.

Next.js app with table-based alumni login, event registration + Razorpay payments, member directory, stories & memories, donations, day-of gate check-in, and a committee admin workspace (including installable PWAs).

## Features

- **Accounts** — signup / login, password reset (Resend), recovery questions  
- **Golden Jubilee registration** — guests, meals, parking, balances, venue pass codes  
- **Payments** — Razorpay checkout + webhook for registrations and donations  
- **Member portal** — directory, events, stories, memories, association  
- **Admin** — memberships, events, registrations, committee, broadcasts, import  
- **Day-of** — `/gate` scanner PIN, `/event-app` and `/admin-app` PWAs, web push  

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 14, React 18, TypeScript, Tailwind |
| Data | Supabase (Postgres + Storage), service-role from the server |
| Auth | `alumni_accounts` + httpOnly session (`AUTH_SECRET`) — not per-user Supabase Auth |
| Payments | Razorpay |
| Email | Resend |
| Hosting | Vercel |

## Quick start

```bash
npm install
cp .env.example .env.local   # fill Supabase + AUTH_SECRET at minimum
npm run dev                  # http://localhost:3000
```

Useful checks:

```bash
npm run type-check
npm run build
```

Full env list: [`.env.example`](.env.example). Never commit `.env.local` or service-role keys.

## Main routes

| Path | Purpose |
|------|---------|
| `/` | Public landing |
| `/signup`, `/login` | Alumni accounts |
| `/registration` | Jubilee event registration |
| `/member` | Verified member home |
| `/directory`, `/events`, `/stories`, `/memories` | Member content |
| `/admin` | Committee workspace |
| `/event-app`, `/admin-app` | Installable day-of / ops PWAs |
| `/gate` | Venue check-in (shared `GATE_PIN`) |

## New account / cutover

Handoff pack (guide + schema SQL + data dump tooling):

**[`migrations/`](migrations/)** — start at [`migrations/README.md`](migrations/README.md)

Canonical schema files also live under [`supabase/migrations/`](supabase/migrations/).

## Deploy (Vercel)

1. Import this repo into a Vercel project  
2. Set all variables from `.env.example` (Supabase, `AUTH_SECRET`, Razorpay, Resend, VAPID, `GATE_PIN`, `NEXT_PUBLIC_APP_URL`)  
3. Deploy, then point the Razorpay webhook at `https://<host>/api/payments/webhook`  

## License / privacy

Private school alumni project. Live database dumps under `migrations/02_data/` are gitignored (PII + password hashes) — regenerate locally with `node scripts/dump-supabase-inserts.mjs`.
