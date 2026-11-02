# Committee ops mobile PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installable phone-first `/admin-app` for committee with only Event ops, Approvals, and Broadcast, without changing desktop `/admin` or the alumni `/event-app` PWA identity.

**Architecture:** Separate `/admin-app` route tree with its own webmanifest and compact shell; extract the three admin tool UIs into shared panels reused by desktop `/admin/*` and `/admin-app/*`; extend login `next` allowlist so admins can return to `/admin-app`.

**Tech Stack:** Next.js App Router, existing `MemberGate`, `PwaInstall`, `/sw.js`, static `public/admin-app.webmanifest`, node self-check scripts.

**Spec:** `docs/superpowers/specs/2026-11-02-admin-ops-pwa-design.md`

## Global Constraints

- Tools in ops app: Event ops, Approvals, Broadcast only.
- No desktop `/admin` “install ops app” link.
- Reuse `/icons/icon-192.png` and `/icons/icon-512.png`; no new artwork.
- Reuse `/sw.js`; do not cache HTML documents.
- Alumni `app/manifest.ts` stays `id`/`start_url` `/event-app`.
- Ops install help only on `/admin-app` home.
- YAGNI: no offline admin mode, no committee push inbox, no check-in in this app.

## Review Focus

- Admin login with `next=/admin-app` must not still hard-redirect to `/admin`.
- `safeRegistrationNext('/admin')` stays rejected; only `/admin-app…` newly allowed among admin paths.
- Visiting `/admin-app` pages must not render the public site navbar.
- Ops pages must call the same admin APIs as desktop (no duplicated fetch URLs).
- `PwaInstall` default path remains `/event-app` so alumni “Get the app” QR does not silently point at ops.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/events/choose-event.ts` | Allow `/admin-app` (+ subpaths) in `safeRegistrationNext` |
| `app/login/page.tsx` | Admins honor allowed `/admin-app…` `next` |
| `scripts/check-choose-event.mjs` | Assert allowlist behavior |
| `components/pwa-install.tsx` | Optional `startPath` (default `/event-app`) |
| `scripts/check-get-app-sidebar.mjs` | Still pass with default `/event-app` |
| `public/admin-app.webmanifest` | Ops PWA identity |
| `components/nav-host.tsx` | Hide chrome for `/admin-app` |
| `components/admin-ops-shell.tsx` | Phone chrome: back, title, logout |
| `app/admin-app/layout.tsx` | Manifest metadata + MemberGate admin + shell |
| `app/admin-app/page.tsx` | Home: 3 links + `PwaInstall startPath="/admin-app"` |
| `components/admin-tools/event-ops-panel.tsx` | Shared event-ops UI (no shell) |
| `components/admin-tools/approvals-panel.tsx` | Shared approvals UI |
| `components/admin-tools/broadcast-panel.tsx` | Shared broadcast UI |
| `app/admin/event-ops/page.tsx` etc. | Thin `AdminShell` wrappers |
| `app/admin-app/event-ops/page.tsx` etc. | Thin ops wrappers |
| `scripts/check-admin-ops-pwa.mjs` | Static wiring assertions |

---

### Task 1: Auth allowlist + admin login `next`

**Files:**
- Modify: `lib/events/choose-event.ts`
- Modify: `app/login/page.tsx`
- Modify: `scripts/check-choose-event.mjs`

**Interfaces:**
- Consumes: existing `safeRegistrationNext(next: string | null | undefined): string | null`
- Produces: same function; additionally accepts `/admin-app`, `/admin-app?...`, `/admin-app/...`

- [ ] **Step 1: Extend failing assertions in `scripts/check-choose-event.mjs`**

```js
assert(safeRegistrationNext('/admin-app') === '/admin-app', 'admin-app return is kept');
assert(safeRegistrationNext('/admin-app/event-ops') === '/admin-app/event-ops', 'admin-app subpath kept');
assert(safeRegistrationNext('/admin') === null, 'admin return is dropped');
```

Keep existing external / protocol-relative rejects.

- [ ] **Step 2: Run check — expect FAIL on admin-app asserts**

Run: `node scripts/check-choose-event.mjs`  
Expected: FAIL mentioning admin-app

- [ ] **Step 3: Implement allowlist in `safeRegistrationNext`**

Accept only paths where `next === '/admin-app'` or `next.startsWith('/admin-app/')` or `next.startsWith('/admin-app?')`. Do not allow bare `/admin`.

- [ ] **Step 4: Fix admin login redirect in `app/login/page.tsx`**

After `const next = safeRegistrationNext(...)`, admin branch:

- if `next` is set and starts with `/admin-app` → `router.push(next)`
- else → `router.push('/admin')`

Non-admin branches unchanged.

- [ ] **Step 5: Re-run check — expect PASS**

Run: `node scripts/check-choose-event.mjs`  
Expected: `PASS choose event`

- [ ] **Step 6: Commit**

```bash
git add lib/events/choose-event.ts app/login/page.tsx scripts/check-choose-event.mjs
git commit -m "$(cat <<'EOF'
Allow admin-app post-login next and honor it for admins.

EOF
)"
```

---

### Task 2: `PwaInstall` configurable `startPath`

**Files:**
- Modify: `components/pwa-install.tsx`
- Modify: `scripts/check-get-app-sidebar.mjs` (only if needed to assert `startPath`)
- Create or extend: assert in Task 6 script is enough if sidebar check already requires `/event-app`

**Interfaces:**
- Consumes: existing `shareMode?: boolean`
- Produces: `PwaInstall({ shareMode?: boolean; startPath?: string })` with default `startPath = '/event-app'`

- [ ] **Step 1: Write failing assert (add to a tiny script or Task 6 draft)**

For this task, add to `scripts/check-get-app-sidebar.mjs` (or a one-liner file read):

```js
assert(install.includes('startPath'), 'PwaInstall accepts startPath');
assert(install.includes("'/event-app'") || install.includes('"/event-app"'), 'default event-app target remains');
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `startPath = '/event-app'` prop; build QR/copy URL from `origin + startPath`**

Keep `shareMode` behavior. Alumni portal dialog unchanged (default path).

- [ ] **Step 4: Run sidebar check — PASS**

Run: `node scripts/check-get-app-sidebar.mjs`

- [ ] **Step 5: Commit**

```bash
git add components/pwa-install.tsx scripts/check-get-app-sidebar.mjs
git commit -m "$(cat <<'EOF'
Let PwaInstall target admin-app or event-app via startPath.

EOF
)"
```

---

### Task 3: Ops manifest, chrome hide, shell + layout + home

**Files:**
- Create: `public/admin-app.webmanifest`
- Create: `components/admin-ops-shell.tsx`
- Create: `app/admin-app/layout.tsx`
- Create: `app/admin-app/page.tsx`
- Modify: `components/nav-host.tsx`

**Interfaces:**
- Consumes: `MemberGate`, `PwaInstall` with `startPath="/admin-app"` and `shareMode`
- Produces: `AdminOpsShell({ title: string; children: ReactNode; homeHref?: string })` — back link to `/admin-app` when not on home; logout via `POST /api/auth/logout`

- [ ] **Step 1: Write `public/admin-app.webmanifest` with exact identity**

```json
{
  "id": "/admin-app",
  "name": "SFS Committee Ops",
  "short_name": "SFS Ops",
  "description": "Event ops, approvals, and broadcast for SFS Golden Jubilee committee.",
  "start_url": "/admin-app",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#001628",
  "theme_color": "#001628",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Hide site chrome** — in `hideSiteChrome`, also true for `/admin-app` and `/admin-app/…`

- [ ] **Step 3: `AdminOpsShell`** — compact top bar (optional back, title, logout); children in padded column `max-w-xl mx-auto`; no PortalShell

- [ ] **Step 4: `app/admin-app/layout.tsx`**

- `export const metadata = { manifest: '/admin-app.webmanifest', applicationName: 'SFS Committee Ops', appleWebApp: { capable: true, title: 'SFS Ops' } }`
- Client gate: wrap children with `MemberGate mode="admin" loginNext="/admin-app"` (layout may be a thin server wrapper + client shell component if metadata requires server layout)

Pattern: server `layout.tsx` exports metadata and renders `<AdminOpsLayoutClient>{children}</AdminOpsLayoutClient>` which applies MemberGate + passes children (home page supplies its own chrome; OR layout always wraps AdminOpsShell only for nested routes — simplest: layout = MemberGate only; each page uses AdminOpsShell including home).

Chosen: **layout = MemberGate only**; pages own `AdminOpsShell`.

- [ ] **Step 5: `app/admin-app/page.tsx` home**

- `AdminOpsShell title="Committee ops"` (no back)
- Three links: `/admin-app/event-ops`, `/admin-app/approvals`, `/admin-app/broadcast` (large rows)
- `<PwaInstall shareMode startPath="/admin-app" />` below

- [ ] **Step 6: Commit**

```bash
git add public/admin-app.webmanifest components/admin-ops-shell.tsx components/nav-host.tsx app/admin-app
git commit -m "$(cat <<'EOF'
Add admin-app shell, manifest, and ops home with install help.

EOF
)"
```

---

### Task 4: Extract shared panels + wire desktop and ops routes

**Files:**
- Create: `components/admin-tools/event-ops-panel.tsx`
- Create: `components/admin-tools/approvals-panel.tsx`
- Create: `components/admin-tools/broadcast-panel.tsx`
- Modify: `app/admin/event-ops/page.tsx`, `app/admin/approvals/page.tsx`, `app/admin/broadcast/page.tsx`
- Create: `app/admin-app/event-ops/page.tsx`, `app/admin-app/approvals/page.tsx`, `app/admin-app/broadcast/page.tsx`

**Interfaces:**
- Consumes: existing fetch URLs (`/api/admin/...`) unchanged inside panels
- Produces: `export default function EventOpsPanel()` (and Approvals/Broadcast) — UI only, no AdminShell/AdminOpsShell

- [ ] **Step 1: Move body of each admin page into the matching panel component** (cut types + logic + JSX out of `AdminShell` wrappers)

- [ ] **Step 2: Desktop pages become**

```tsx
<AdminShell title="…">
  <EventOpsPanel />
</AdminShell>
```

(same for Approvals / Broadcast with their titles)

- [ ] **Step 3: Ops pages become**

```tsx
<AdminOpsShell title="…">
  <EventOpsPanel />
</AdminOpsShell>
```

Titles: `Event ops`, `Approvals`, `Broadcast`. Back to `/admin-app` enabled in shell when pathname !== `/admin-app`.

- [ ] **Step 4: Smoke — `npm run type-check`**

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add components/admin-tools app/admin/event-ops app/admin/approvals app/admin/broadcast app/admin-app
git commit -m "$(cat <<'EOF'
Share event-ops, approvals, and broadcast panels with admin-app routes.

EOF
)"
```

---

### Task 5: Static check script + graphify

**Files:**
- Create: `scripts/check-admin-ops-pwa.mjs`

- [ ] **Step 1: Write script asserts**

Read files and assert:

- `public/admin-app.webmanifest` contains `"id": "/admin-app"` and `"start_url": "/admin-app"` and `SFS Ops`
- `nav-host.tsx` hides `/admin-app`
- `choose-event.ts` allows `/admin-app`
- `login/page.tsx` mentions `/admin-app` in admin redirect branch
- `app/admin-app/page.tsx` links the three tools and uses `startPath="/admin-app"` (or `startPath='/admin-app'`)
- panel files exist and desktop + ops pages import them
- `pwa-install.tsx` has `startPath`

- [ ] **Step 2: Run**

Run: `node scripts/check-admin-ops-pwa.mjs`  
Expected: `PASS admin-ops pwa`

Also: `node scripts/check-choose-event.mjs` and `node scripts/check-get-app-sidebar.mjs`

- [ ] **Step 3: `graphify update .`**

- [ ] **Step 4: Commit**

```bash
git add scripts/check-admin-ops-pwa.mjs graphify-out
git commit -m "$(cat <<'EOF'
Add admin-ops PWA self-check and refresh graph.

EOF
)"
```

---

## Self-review notes

- Spec coverage: routes, dual manifest, SW reuse, install-only-on-home, auth next, chrome hide, shared panels, testing — each has a task.
- Review Focus items pinned in Tasks 1, 2, 3, 5.
- No desktop install link task (explicitly out of scope).

## Execution

After plan approval, run with **subagent-driven-development** (preferred) or **executing-plans** in this workspace.
