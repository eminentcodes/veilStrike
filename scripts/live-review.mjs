import { chromium } from 'playwright';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
await mkdir('verification/screenshots', { recursive: true });
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath && process.env.LOCALAPPDATA) {
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
  for (const folder of (await readdir(cache).catch(() => [])).filter(n => /^chromium-[0-9]+$/.test(n)).sort().reverse()) {
    const candidate = join(cache, folder, 'chrome-win64', 'chrome.exe');
    if (existsSync(candidate)) { executablePath = candidate; break; }
  }
}
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('main', { timeout: 20000 });
  await page.waitForTimeout(1200);
  checks.push({ name: 'app renders', passed: await page.locator('main').isVisible(), text: (await page.locator('main').innerText()).slice(0, 1200) });
  await page.screenshot({ path: 'verification/screenshots/live-lobby.png' });
  if (process.argv.includes('--full')) {
    await page.getByRole('button', { name: 'Characters', exact: true }).click();
    checks.push({ name: 'ten characters', passed: await page.locator('.roster-choice').count() === 10 });
    await page.getByRole('button', { name: /TAREN.*Select/ }).click();
    await page.getByRole('button', { name: 'Close panel' }).click();
    await page.getByRole('button', { name: 'Audio settings' }).click();
    checks.push({ name: 'four audio channels', passed: await page.locator('input[type=range]').count() === 4 });
    await page.getByRole('button', { name: 'Close panel' }).click();
    await page.getByRole('button', { name: /^PLAY/ }).click();
    await page.waitForSelector('.duel-loading', { state: 'detached', timeout: 25000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'verification/screenshots/live-combat.png' });
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(100);
    checks.push({ name: 'light attack responds', passed: await page.evaluate(() => !!window.__veilstrike.getSnapshot().fighters[0].attack) });
    await page.getByRole('button', { name: /MENU/ }).click();
    const pausedTime = await page.evaluate(() => window.__veilstrike.getSnapshot().time);
    await page.waitForTimeout(250);
    checks.push({ name: 'pause freezes combat', passed: await page.evaluate(t => window.__veilstrike.getSnapshot().time === t, pausedTime) });
    checks.push({ name: 'pause suspends music', passed: await page.evaluate(() => window.__veilstrikeAudio.status().suspended) });
    await page.getByRole('button', { name: 'LEAVE ARENA' }).click();
    await page.waitForTimeout(500);
    checks.push({ name: 'lobby music resumes', passed: await page.evaluate(() => window.__veilstrikeAudio.status().mode === 'menu') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'verification/screenshots/live-mobile.png' });
    checks.push({ name: 'mobile fits viewport', passed: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  }
} catch (e) { errors.push(e.message); }
await writeFile('verification/live-review.json', JSON.stringify({ checks, errors }, null, 2));
console.log(JSON.stringify({ checks, errors }, null, 2));
await browser.close();
if (errors.length || checks.some(c => !c.passed)) process.exitCode = 1;
