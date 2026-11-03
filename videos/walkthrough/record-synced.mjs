#!/usr/bin/env node
/**
 * Record one webm per scene, dwelling for VO duration so narration matches the screen.
 * Auth is prepared in a silent context (storageState) so login is not repeated on every clip.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT = join(ROOT, 'out');
const BASE = (process.env.WALKTHROUGH_BASE_URL || 'https://test-sfs-alumni-alpha.vercel.app').replace(
  /\/$/,
  '',
);
const VIEW = { width: 1440, height: 900 };
const PAD_MS = 900;

const alumniUser = process.env.WALKTHROUGH_ALUMNI_USER;
const alumniPass = process.env.WALKTHROUGH_ALUMNI_PASS;
const adminUser = process.env.WALKTHROUGH_ADMIN_USER;
const adminPass = process.env.WALKTHROUGH_ADMIN_PASS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollDuring(page, ms) {
  const start = Date.now();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(500);
  const { height, view } = await page.evaluate(() => ({
    height: document.body.scrollHeight,
    view: window.innerHeight,
  }));
  if (height > view + 80) {
    const remaining = () => Math.max(0, ms - (Date.now() - start));
    const steps = Math.max(3, Math.floor(ms / 2500));
    for (let i = 1; i <= steps; i++) {
      const left = remaining();
      if (left < 400) break;
      await page.evaluate(
        ([h, s, i]) => window.scrollTo({ top: (h * i) / (s + 1), behavior: 'smooth' }),
        [height, steps, i],
      );
      await sleep(Math.min(2200, Math.floor(left / (steps - i + 1))));
    }
  }
  const left = ms - (Date.now() - start);
  if (left > 0) await sleep(left);
}

async function dwell(page, ms, scroll) {
  if (scroll) await scrollDuring(page, ms);
  else await sleep(ms);
}

async function loginSilent(browser, user, pass, nextPath, statePath) {
  const context = await browser.newContext({ viewport: VIEW });
  const page = await context.newPage();
  await page.goto(`${BASE}/login?next=${encodeURIComponent(nextPath)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForSelector('#login-username', { timeout: 30000 });
  await page.fill('#login-username', user);
  await page.fill('#login-password', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 90000 });
  await sleep(800);
  await context.storageState({ path: statePath });
  await context.close();
}

function storageForScene(scene, statePath) {
  if (scene.action === 'login-alumni' || scene.action === 'login-admin') return null;
  if (scene.path === '/' || scene.path === '/signup') return null;
  return statePath;
}

async function recordAudience(browser, audience) {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'vo', `${audience}-scenes.json`), 'utf8'));
  const sceneDir = join(OUT, 'scenes', audience);
  mkdirSync(sceneDir, { recursive: true });

  const statePath = join(OUT, `${audience}-state.json`);
  if (audience === 'alumni') {
    if (!alumniUser || !alumniPass) throw new Error('Missing alumni credentials');
    await loginSilent(browser, alumniUser, alumniPass, '/member', statePath);
  } else {
    if (!adminUser || !adminPass) throw new Error('Missing admin credentials');
    await loginSilent(browser, adminUser, adminPass, '/admin', statePath);
  }

  for (const scene of manifest) {
    const targetMs = Math.round(scene.duration * 1000) + PAD_MS;
    console.log(`→ ${audience}/${scene.id} (${(targetMs / 1000).toFixed(1)}s)`);

    const state = storageForScene(scene, statePath);
    const ctx = await browser.newContext({
      viewport: VIEW,
      recordVideo: { dir: sceneDir, size: VIEW },
      ...(state ? { storageState: state } : {}),
    });
    const page = await ctx.newPage();
    const t0 = Date.now();
    try {
      if (scene.action === 'login-alumni') {
        await page.goto(`${BASE}/login?next=${encodeURIComponent('/member')}`, {
          waitUntil: 'domcontentloaded',
          timeout: 90000,
        });
        await page.waitForSelector('#login-username', { timeout: 30000 });
        await sleep(700);
        await page.fill('#login-username', alumniUser);
        await sleep(450);
        await page.fill('#login-password', alumniPass);
        await sleep(450);
        await page.click('button[type="submit"]');
        await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 90000 });
        await sleep(800);
        await ctx.storageState({ path: statePath });
      } else if (scene.action === 'login-admin') {
        await page.goto(`${BASE}/login?next=${encodeURIComponent('/admin')}`, {
          waitUntil: 'domcontentloaded',
          timeout: 90000,
        });
        await page.waitForSelector('#login-username', { timeout: 30000 });
        await sleep(700);
        await page.fill('#login-username', adminUser);
        await sleep(450);
        await page.fill('#login-password', adminPass);
        await sleep(450);
        await page.click('button[type="submit"]');
        await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 90000 });
        await sleep(800);
        await ctx.storageState({ path: statePath });
      } else {
        await page.goto(`${BASE}${scene.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 90000,
        });
        await sleep(700);
        if (scene.action === 'logout') {
          const btn = page.getByRole('button', { name: /log out|sign out/i }).first();
          if (await btn.count()) {
            await btn.click();
            await sleep(1200);
          }
        }
      }
      const used = Date.now() - t0;
      await dwell(page, Math.max(1200, targetMs - used), !!scene.scroll);
    } finally {
      const video = page.video();
      await ctx.close();
      const tmp = await video?.path();
      if (tmp) {
        const dest = join(sceneDir, `${scene.id}.webm`);
        rmSync(dest, { force: true });
        renameSync(tmp, dest);
      }
    }
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const which = process.argv[2] || 'both';
  const browser = await chromium.launch({ headless: true });
  try {
    if (which === 'alumni' || which === 'both') await recordAudience(browser, 'alumni');
    if (which === 'committee' || which === 'both') await recordAudience(browser, 'committee');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
