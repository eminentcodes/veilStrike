import { chromium } from 'playwright';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const executablePath = (await readdir(join(process.env.LOCALAPPDATA, 'ms-playwright')))
  .filter(name => /^chromium-[0-9]+$/.test(name)).sort().reverse()
  .map(name => join(process.env.LOCALAPPDATA, 'ms-playwright', name, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [], checks = [];
const base = process.env.REVIEW_URL || 'http://127.0.0.1:5173/';
await mkdir('verification/screenshots/roadmap', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#roadmap');
  await page.getByRole('heading', { name: 'Built for battle.', exact: true }).waitFor();
  assert.equal(await page.locator('.prepared-lobby').count(), 0, 'Direct roadmap entry must not load a combat renderer');
  await page.waitForFunction(() => [...document.querySelectorAll('.roadmap-page img')].every(img => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: 'verification/screenshots/roadmap/current.png', fullPage: true, animations: 'disabled' });
  checks.push('Direct route, loaded artwork, current build, separate page title');
  assert.equal(await page.title(), 'Development roadmap | Veilstrike');

  await page.getByRole('tab', { name: /Current build/ }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'Beyond the arena.', exact: true }).waitFor();
  assert.deepEqual(await page.locator('.roadmap-point strong').allTextContents(), ['Story Mode', 'More arenas', 'More fighters', 'Leaderboard rankings', 'Achievements']);
  await page.screenshot({ path: 'verification/screenshots/roadmap/next.png', fullPage: true, animations: 'disabled' });
  await page.keyboard.press('End');
  await page.getByRole('heading', { name: 'More ways to play.', exact: true }).waitFor();
  assert.deepEqual(await page.locator('.roadmap-point strong').allTextContents(), ['A possible game token', 'A mobile app launch', 'More events']);
  assert.ok(await page.getByRole('button', { name: 'Play presentation', exact: true }).isVisible());
  checks.push('Keyboard phase navigation, all next priorities, exploratory economy/mobile/events');

  await page.clock.install();
  await page.getByRole('button', { name: 'Play presentation', exact: true }).click();
  await page.clock.fastForward(19000);
  await page.clock.fastForward(1500);
  assert.equal(await page.locator('.roadmap-scene').getAttribute('data-phase'), 'now');
  await page.getByRole('button', { name: 'Pause presentation', exact: true }).dispatchEvent('click');
  await page.clock.fastForward(22000);
  assert.equal(await page.locator('.roadmap-scene').getAttribute('data-phase'), 'now');
  checks.push('Automatic phase advance and explicit pause');
  await page.close();

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const mobile = await reduced.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(base + '#roadmap');
  await mobile.getByRole('heading', { name: 'Built for battle.', exact: true }).waitFor();
  assert.equal(await mobile.getByRole('button', { name: 'Pause presentation', exact: true }).count(), 0);
  await mobile.getByRole('tab', { name: /Next phase/ }).click();
  await mobile.getByRole('heading', { name: 'Beyond the arena.', exact: true }).waitFor();
  const layout = await mobile.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, controls: document.querySelector('.roadmap-controls').getBoundingClientRect().top, scene: document.querySelector('.roadmap-scene').getBoundingClientRect().top }));
  assert.ok(layout.page <= layout.viewport, 'Mobile page overflows horizontally');
  assert.ok(layout.controls < layout.scene, 'Mobile phase navigation should precede the artwork');
  await mobile.screenshot({ path: 'verification/screenshots/roadmap/mobile.png', fullPage: true, animations: 'disabled' });
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.getByRole('tab', { name: /Beyond/ }).click();
  await mobile.getByRole('heading', { name: 'More ways to play.', exact: true }).waitFor();
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push({ mobile: layout, reducedMotion: 'manual navigation', landscape: 'no horizontal overflow' });
  assert.deepEqual(errors, []);
  console.log('PASS: roadmap route, images, phase navigation, next priorities, autoplay/pause, mobile, landscape, and reduced motion.');
} finally {
  await writeFile('verification/roadmap-review.json', JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
