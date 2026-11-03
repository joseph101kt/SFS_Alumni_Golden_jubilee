#!/usr/bin/env node
/**
 * ponytail: ceiling = static string checks that alumni sidebar exposes
 * Get the app → QR + iPhone/Android install copy. Upgrade: Playwright open dialog.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shell = readFileSync(join(root, 'components/portal-shell.tsx'), 'utf8');
const install = readFileSync(join(root, 'components/pwa-install.tsx'), 'utf8');
const dialog = readFileSync(join(root, 'components/get-app-dialog.tsx'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(shell.includes('Get the app'), 'portal shell has Get the app control');
assert(
  shell.includes('get-app-dialog') || shell.includes('GetAppDialog'),
  'portal shell wires GetAppDialog'
);
assert(dialog.includes('role="dialog"') || dialog.includes("role='dialog'"), 'opens a dialog');
assert(install.includes('/event-app'), 'QR/link targets event-app');
assert(install.includes('iPhone'), 'iPhone install steps');
assert(install.includes('Edit Actions'), 'old iPhone Add to Home Screen recovery');
assert(install.includes('isIosNonSafari'), 'warn when iPhone is not Safari');
assert(install.includes('swipe sideways'), 'tell users to swipe Share sheet icons');
assert(install.includes('Android'), 'Android install steps');
assert(
  install.includes('shareMode') || install.includes('alwaysShowQr'),
  'install guide can force QR for desktop share'
);
assert(install.includes('startPath'), 'PwaInstall accepts startPath');

console.log('PASS get-app sidebar');
