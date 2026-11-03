#!/usr/bin/env node
/**
 * Desktop webapp walkthrough capture (not mobile PWAs).
 *
 *   WALKTHROUGH_BASE_URL=https://test-sfs-alumni-alpha.vercel.app \
 *   WALKTHROUGH_ALUMNI_USER=... WALKTHROUGH_ALUMNI_PASS=... \
 *   WALKTHROUGH_ADMIN_USER=... WALKTHROUGH_ADMIN_PASS=... \
 *   node videos/walkthrough/record.mjs [alumni|committee|both]
 */
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');
const BASE = (process.env.WALKTHROUGH_BASE_URL || 'https://test-sfs-alumni-alpha.vercel.app').replace(
  /\/$/,
  '',
);
const VIEW = { width: 1440, height: 900 };

const alumniUser = process.env.WALKTHROUGH_ALUMNI_USER;
const alumniPass = process.env.WALKTHROUGH_ALUMNI_PASS;
const adminUser = process.env.WALKTHROUGH_ADMIN_USER;
const adminPass = process.env.WALKTHROUGH_ADMIN_PASS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollTour(page, ms) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(Math.min(1200, ms));
  const { height, view } = await page.evaluate(() => ({
    height: document.body.scrollHeight,
    view: window.innerHeight,
  }));
  if (height <= view + 80) {
    await sleep(Math.max(0, ms - 1200));
    return;
  }
  const steps = Math.max(3, Math.floor(ms / 2200));
  const slice = Math.floor(ms / (steps + 1));
  for (let i = 1; i <= steps; i++) {
    await page.evaluate(
      ([h, s, i]) => window.scrollTo({ top: (h * i) / (s + 1), behavior: 'smooth' }),
      [height, steps, i],
    );
    await sleep(slice);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(800);
}

async function show(page, path, ms = 6000) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(1000);
  await scrollTour(page, ms);
}

async function clickNav(page, name, ms = 5000) {
  const link = page.getByRole('link', { name, exact: true }).first();
  if (await link.count()) {
    await link.click();
    await sleep(1200);
    await scrollTour(page, ms);
    return true;
  }
  return false;
}

async function login(page, username, password, nextPath) {
  const loginUrl = nextPath
    ? `${BASE}/login?next=${encodeURIComponent(nextPath)}`
    : `${BASE}/login`;
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#login-username', { timeout: 30000 });
  await sleep(1500);
  await page.fill('#login-username', username);
  await sleep(600);
  await page.fill('#login-password', password);
  await sleep(600);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 90000 });
  await sleep(2000);
}

async function finishVideo(page, context, filename) {
  const video = page.video();
  await context.close();
  const path = await video?.path();
  if (path) {
    renameSync(path, join(OUT, filename));
    console.log('Wrote', join(OUT, filename));
  }
}

async function recordAlumni(browser) {
  if (!alumniUser || !alumniPass) throw new Error('Set WALKTHROUGH_ALUMNI_USER / PASS');
  const context = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: OUT, size: VIEW },
  });
  const page = await context.newPage();
  try {
    // Public site
    await show(page, '/', 28160);
    await clickNav(page, 'Sign up', 12800);
    await show(page, '/signup', 10240);
    await clickNav(page, 'Login', 5120);
    await login(page, alumniUser, alumniPass, '/member');

    // Portal home + donate CTA
    await show(page, '/member', 23040);
    const donateCard = page.getByRole('link', { name: /Donate to a cause|Give now/i }).first();
    if (await donateCard.count()) {
      await donateCard.click();
      await sleep(1200);
      await scrollTour(page, 20480);
    } else {
      await show(page, '/member/donate', 20480);
    }

    // Portal nav — every item
    await show(page, '/member', 7680);
    if (!(await clickNav(page, 'People', 17920))) await show(page, '/directory', 17920);
    if (!(await clickNav(page, 'Events', 15360))) await show(page, '/events', 15360);

    // Open first event / registration if present
    const eventLink = page.locator('a[href*="/events"], a[href*="registration"]').filter({ hasText: /.+/ }).first();
    const regCta = page.getByRole('link', { name: /register|continue|open/i }).first();
    if (await regCta.count()) {
      await regCta.click();
      await sleep(1500);
      await scrollTour(page, 12800);
    }
    await show(page, '/registration', 35840);

    if (!(await clickNav(page, 'Stories', 15360))) await show(page, '/stories', 15360);
    if (!(await clickNav(page, 'Memories', 15360))) await show(page, '/memories', 15360);
    if (!(await clickNav(page, 'My submissions', 20480))) await show(page, '/submissions', 20480);

    await show(page, '/about-association', 15360);
    await show(page, '/account/password', 10240);
    await show(page, '/account/recovery', 10240);
    await show(page, '/member', 10240);

    // Logout if visible
    const logout = page.getByRole('button', { name: /log out|sign out/i }).first();
    if (await logout.count()) {
      await logout.click();
      await sleep(2500);
      await scrollTour(page, 6400);
    } else {
      await show(page, '/', 6400);
    }
  } finally {
    await finishVideo(page, context, 'alumni-raw.webm');
  }
}

async function recordCommittee(browser) {
  if (!adminUser || !adminPass) throw new Error('Set WALKTHROUGH_ADMIN_USER / PASS');
  const context = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: OUT, size: VIEW },
  });
  const page = await context.newPage();
  try {
    await show(page, '/', 7680);
    await login(page, adminUser, adminPass, '/admin');
    await show(page, '/admin', 20480);

    const adminPaths = [
      ['/admin/event-ops', 23040],
      ['/admin/approvals', 23040],
      ['/admin/check-in', 15360],
      ['/admin/broadcast', 15360],
      ['/admin/membership', 17920],
      ['/admin/events', 20480],
      ['/admin/registrations', 20480],
      ['/admin/memories', 15360],
      ['/admin/stories', 15360],
      ['/admin/committee', 17920],
      ['/admin/donations', 17920],
      ['/admin/import', 12800],
      ['/admin', 10240],
    ];

    for (const [path, ms] of adminPaths) {
      // Prefer sidebar click by path href when present
      const side = page.locator(`a[href="${path}"]`).first();
      if (await side.count()) {
        await side.click();
        await sleep(1200);
        await scrollTour(page, ms);
      } else {
        await show(page, path, ms);
      }
    }

    const logout = page.getByRole('button', { name: /log out|sign out/i }).first();
    if (await logout.count()) {
      await logout.click();
      await sleep(2500);
    }
  } finally {
    await finishVideo(page, context, 'committee-raw.webm');
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const which = process.argv[2] || 'both';
  const browser = await chromium.launch({ headless: true });
  try {
    if (which === 'alumni' || which === 'both') await recordAlumni(browser);
    if (which === 'committee' || which === 'both') await recordCommittee(browser);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
