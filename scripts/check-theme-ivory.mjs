#!/usr/bin/env node
/**
 * ponytail: ceiling = static string checks on globals + portal shell.
 * Upgrade: visual regression snapshots when we add Playwright.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
const shell = readFileSync(join(root, 'components/portal-shell.tsx'), 'utf8');
const nav = readFileSync(join(root, 'components/navbar.tsx'), 'utf8');

const needCss = [
  ['--color-background: #faf8f4', 'ivory background'],
  ['--color-primary: #14110f', 'charcoal primary'],
  ['--color-jubilee-gold-deep: #8a6a3a', 'muted bronze'],
  ['font-size: 46px', 'enlarged headline-lg'],
  ['font-size: 34px', 'enlarged headline-md'],
  ['font-size: 17px', 'enlarged body-md'],
];
const needShell = [
  ['Alumni portal', 'portal nav'],
  ['sticky top-28', 'side rail'],
  ['bg-surface', 'stone/ivory surface'],
];
const needNav = [['bg-surface-paper', 'paper navbar'], ['border-outline-variant', 'quiet border']];

let failed = 0;
for (const [needle, label] of needCss) {
  if (!css.includes(needle)) {
    console.error('FAIL css:', label);
    failed++;
  }
}
for (const [needle, label] of needShell) {
  if (!shell.includes(needle)) {
    console.error('FAIL shell:', label);
    failed++;
  }
}
if (shell.includes('lg:hidden') || shell.includes("variant === 'strip'")) {
  console.error('FAIL shell: top strip still present');
  failed++;
}
for (const [needle, label] of needNav) {
  if (!nav.includes(needle)) {
    console.error('FAIL nav:', label);
    failed++;
  }
}

if (failed) {
  console.error(`FAIL theme ivory self-check (${failed})`);
  process.exit(1);
}
console.log('PASS theme ivory self-check');
