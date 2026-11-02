# Committee ops mobile PWA (`/admin-app`) — design

**Status:** Approved in conversation (2026-11-02)  
**Audience:** Verified admin / committee accounts  
**Approach:** Separate phone-first shell with mirrored routes; reuse existing admin tool UIs

## Goal

Give committee staff an **installable mobile app** whose home screen opens a thin ops shell with only **Event ops**, **Approvals**, and **Broadcast**. Desktop `/admin` stays unchanged. Alumni event-app PWA (`/event-app`) stays unchanged for members.

## Out of scope (v1)

- Check-in, gate scanner, membership, donations, import, committee editor, etc. inside this app
- “Install ops app” entry point on desktop `/admin` (install help lives only on `/admin-app`)
- Distinct ops icon artwork (reuse existing `/icons/icon-192.png` and `icon-512.png`)
- Offline-first caching of admin HTML or APIs
- Push notifications *to* committee devices in this app
- Changes to alumni “Get the app” / event-app install flow beyond leaving it alone

## Architecture & routes

### Shell

- New route tree under `/admin-app`.
- Hide site chrome (navbar) for `/admin-app` and subpaths — same pattern as event-app / gate via `NavHost` + `x-pathname`.
- Layout: `MemberGate mode="admin"` + compact ops chrome (title, back to home, logout). No `PortalShell`, no full desktop `AdminShell` link list.

### Screens

| Route | Role |
|-------|------|
| `/admin-app` | Home: three large links + install help (QR + iPhone/Android) |
| `/admin-app/event-ops` | Same behavior as `/admin/event-ops` |
| `/admin-app/approvals` | Same behavior as `/admin/approvals` |
| `/admin-app/broadcast` | Same behavior as `/admin/broadcast` |

Desktop `/admin/...` remains as-is. Extract shared page bodies so desktop and ops shells call the same UI logic (no duplicated business UI).

### Auth

- Same admin session as today (`role === 'admin'` and `member_status === 'verified'`).
- Extend `safeRegistrationNext` in `lib/events/choose-event.ts` to allow `/admin-app` and its subpaths (reject protocol-relative / absolute URLs as today).
- Login must **honor** an allowed `next` for admins (today admins are always forced to `/admin` — if `next` is `/admin-app…`, go there; otherwise keep `/admin` default).
- Forbidden non-admin: clear committee-only message.

## PWA install (second home-screen app)

### Manifest

- Keep root `app/manifest.ts` for alumni event-app (`id` / `start_url` → `/event-app`).
- Add a separate static manifest (e.g. `public/admin-app.webmanifest`):
  - `id` / `start_url`: `/admin-app`
  - `name`: “SFS Committee Ops”
  - `short_name`: “SFS Ops”
  - `display`: `standalone`, portrait-primary
  - Reuse existing icons
- `/admin-app` layout sets `metadata.manifest` to that file so installs from those pages are the ops app.

### Service worker

- Reuse existing `/sw.js` (icons + web push; do not cache HTML documents). One SW per origin is enough; the second app is primarily manifest + start URL.

### Install UX

- Install help (QR targeting `/admin-app`, copy link, iPhone/Android steps) appears **only** on `/admin-app` home.
- Reuse / extend `PwaInstall` with a configurable target URL (default remains `/event-app` for alumni; ops uses `/admin-app`).
- No desktop `/admin` install link in v1.

## UI

### Home

- Phone-first stack: ops brand line, then three large tappable rows — Event ops, Approvals, Broadcast.
- Install block below the three tools.
- Signed-out: gate to login with `next=/admin-app`. Logout available on home / shell.

### Inner screens

- Compact top bar: back to `/admin-app`, screen title, logout.
- Existing tool content with tighter mobile padding; no desktop mega-nav.
- Same APIs and error messages as desktop admin tools.

### Errors / offline

- API failures: same copy as desktop.
- No special offline mode in v1.

## Testing

- Static check script asserting: `/admin-app` routes/shell wiring, ops manifest `start_url`/`id`, login `next` allowlist includes admin-app, site chrome hidden for admin-app, `PwaInstall` can target `/admin-app`.
- Manual: admin login with `?next=/admin-app` lands on ops home; non-admin blocked; three tools work against existing APIs; QR opens `/admin-app`; desktop `/admin` unchanged.

## Success criteria

1. Committee can install “SFS Ops” from `/admin-app` without affecting the alumni Jubilee PWA identity.
2. Installed app opens to the three-tool home (event ops, approvals, broadcast only).
3. Admin login return path to `/admin-app` works.
4. Desktop committee workspace and alumni event-app install flows remain intact.
