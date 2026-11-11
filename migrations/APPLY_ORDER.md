# Apply order (inside this pack)

## 1. Schema — `01_schema/`

Run in SQL Editor, **filename order**:

1. `20261025_sfs_alumni_portal.sql`
2. `20261025_alumni_accounts.sql`
3. `20261025_alumni_profile_registration_fields.sql`
4. `20261025_event_catalog_registrations.sql`
5. `20261025_jubilee_reg_status.sql`
6. `20261025_registration_balance_razorpay.sql`
7. `20261026_account_username_name.sql`
8. `20261026_meal_diet_prices.sql`
9. `20261026_registration_code.sql`
10. `20261027_registration_guests.sql`
11. `20261028_alumni_memories_storage.sql`
12. `20261028_alumni_stories_accounts.sql`
13. `20261028_password_reset_tokens.sql`
14. `20261029_recovery_questions.sql`
15. `20261031_committee_members.sql`
16. `20261031_committee_bio.sql`
17. `20261031_committee_public_read.sql`
18. `20261031_donations.sql`
19. `20261101_event_check_in.sql`
20. `20261101_event_fee_batch_paise.sql`
21. `20261101_event_fee_batch_range.sql`
22. `20261101_event_refund_email.sql`
23. `20261101_push_and_broadcasts.sql`
24. `20261107_registration_self_lunch.sql`
25. `20261108120000_event_registrations_bank_ref_core_verify.sql`
26. `20261109090000_event_registration_donation_link.sql`
27. `20261109120000_jubilee_status_from_registrations.sql`
28. `20261109130000_gate_partial_checkin.sql`

## 2. Data — `02_data/`

- Prefer: `full_data_dump.sql`
- Or: `tables/01_*.sql` … `tables/11_*.sql`
- Skip: `optional_users.sql` (unless recreating `auth.users`)

Regenerate:

```bash
node scripts/dump-supabase-inserts.mjs
```

## 3. Storage (not SQL)

Copy buckets `committee-photos` and `alumni-memories`.
