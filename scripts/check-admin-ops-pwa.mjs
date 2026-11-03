#!/usr/bin/env node
/**
 * ponytail: ceiling = static wiring for /admin-app ops PWA.
 * Upgrade: Playwright install + login next on a device.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(!existsSync(join(root, 'app/manifest.ts')), 'app/manifest.ts must not exist (it overrides metadata.manifest)');

const manifest = read('public/admin-app.webmanifest');
assert(manifest.includes('"id": "/admin-app"'), 'manifest id');
assert(manifest.includes('"start_url": "/admin-app"'), 'manifest start_url');
assert(manifest.includes('SFS Ops'), 'manifest short name');
assert(manifest.includes('icon-ops-192.png'), 'ops uses distinct 192 icon');
assert(manifest.includes('icon-ops-512.png'), 'ops uses distinct 512 icon');
assert(!manifest.includes('/icons/icon-192.png'), 'ops does not reuse alumni 192 icon');
assert(existsSync(join(root, 'public/icons/icon-ops-192.png')), 'ops 192 icon file exists');
assert(existsSync(join(root, 'public/icons/icon-ops-512.png')), 'ops 512 icon file exists');

const eventManifest = read('public/event-app.webmanifest');
assert(eventManifest.includes('"id": "/event-app"'), 'event manifest id');
assert(eventManifest.includes('"start_url": "/event-app"'), 'event manifest start_url');

const rootLayout = read('app/layout.tsx');
assert(rootLayout.includes("manifest: '/event-app.webmanifest'") || rootLayout.includes('manifest: "/event-app.webmanifest"'), 'root uses event-app.webmanifest');
const adminLayout = read('app/admin-app/layout.tsx');
assert(adminLayout.includes("manifest: '/admin-app.webmanifest'") || adminLayout.includes('manifest: "/admin-app.webmanifest"'), 'admin-app layout uses admin-app.webmanifest');

const gate = read('components/member-gate.tsx');
assert(!gate.includes('Redirecting to login'), 'admin-app must not auto-redirect signed-out (breaks ops install URL)');

const nav = read('components/nav-host.tsx');
assert(nav.includes('/admin-app'), 'nav hides admin-app chrome');

const choose = read('lib/events/choose-event.ts');
assert(choose.includes('/admin-app'), 'safeRegistrationNext allows admin-app');

const login = read('app/login/page.tsx');
assert(login.includes('/admin-app'), 'login honors admin-app next');

const home = read('app/admin-app/page.tsx');
assert(home.includes('/admin-app/event-ops'), 'home links event-ops');
assert(home.includes('/admin-app/approvals'), 'home links approvals');
assert(home.includes('/admin-app/broadcast'), 'home links broadcast');
assert(!home.includes('PwaInstall'), 'install help is not inline on admin-app home');

const adminShell = read('components/admin-shell.tsx');
assert(adminShell.includes('Get the app'), 'desktop admin has Get the app');
assert(
  adminShell.includes('startPath="/admin-app"') || adminShell.includes("startPath='/admin-app'"),
  'admin Get the app targets admin-app'
);
assert(adminShell.includes('appLabel="SFS Ops"') || adminShell.includes("appLabel='SFS Ops'"), 'ops QR labeled SFS Ops');
const portal = read('components/portal-shell.tsx');
assert(
  portal.includes('startPath="/event-app"') || portal.includes("startPath='/event-app'"),
  'alumni Get the app targets event-app'
);
assert(
  !portal.includes('startPath="/admin-app"'),
  'alumni Get the app must not point at admin-app'
);

const install = read('components/pwa-install.tsx');
assert(install.includes('startPath'), 'PwaInstall has startPath');


for (const panel of [
  'components/admin-tools/event-ops-panel.tsx',
  'components/admin-tools/approvals-panel.tsx',
  'components/admin-tools/broadcast-panel.tsx',
]) {
  assert(existsSync(join(root, panel)), `missing ${panel}`);
}

for (const page of [
  'app/admin/event-ops/page.tsx',
  'app/admin/approvals/page.tsx',
  'app/admin/broadcast/page.tsx',
  'app/admin-app/event-ops/page.tsx',
  'app/admin-app/approvals/page.tsx',
  'app/admin-app/broadcast/page.tsx',
]) {
  const src = read(page);
  assert(
    src.includes('admin-tools/') || src.includes("admin-tools/"),
    `${page} imports shared panel`
  );
}

console.log('PASS admin-ops pwa');
