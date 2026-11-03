# Live data INSERTs

| File | Purpose |
|------|---------|
| `full_data_dump.sql` | One transaction: DELETE + INSERT (FK-safe) |
| `tables/NN_*.sql` | Per-table inserts |
| `optional_users.sql` | Legacy `public.users` — skip for normal cutover |
| `dump_summary.json` | Row counts |

Regenerate (`.env.local` → **source** project):

```bash
node scripts/dump-supabase-inserts.mjs
```

Contains **password hashes + PII**. Gitignored. Apply **after** `01_schema/`.
