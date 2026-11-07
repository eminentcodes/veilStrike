import { chromium } from 'playwright';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const base = (process.env.REVIEW_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = (await readdir(cache)).filter(n => /^chromium-[0-9]+$/.test(n)).sort().reverse()
  .map(n => join(cache, n, 'chrome-win64', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 780 } });
page.setDefaultTimeout(60000);
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.stack || error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => {
  if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
  if (response.url().endsWith('.glb') && response.headers()['content-type']?.includes('text/html')) {
    errors.push('HTML returned for model: ' + response.url());
  }
});
await mkdir('verification/screenshots', { recursive: true });
const ready = async selector => {
  await page.locator(selector).waitFor({ state: 'attached', timeout: 120000 });
  await page.waitForTimeout(300);
};
try {
  await page.goto(base, { waitUntil: 'commit' });
  console.log('Opened game; waiting for the initial 3D lobby.');
  await ready('.game-lobby > .lobby-scene[data-ready="true"]');
  console.log('Initial Karen lobby is ready.');
  for (const [id, name] of [['karen', 'Karen'], ['taren', 'Taren'], ['nomet', 'Nomet']]) {
    await page.getByRole('button', { name: 'Characters', exact: true }).click();
    await page.getByRole('button', { name: name.toUpperCase() + ' Select', exact: true }).click();
    await ready('.collection-model .lobby-scene[data-ready="true"]');
    console.log(name + ' collection preview is ready.');
    const preview = await page.evaluate(() => {
      const stage = window.__veilstrikeLobby;
      return { id: stage.fighters[0].id, loaded: !!stage.fighters[0].model, source: stage.fighters[0].modelSource,
        animationTime: stage.fighters[0].mixer?.time, width: stage.renderer.domElement.width,
        height: stage.renderer.domElement.height, triangles: stage.renderer.info.render.triangles };
    });
    assert.equal(preview.id, id); assert.equal(preview.loaded, true); assert.equal(preview.source, 'blender');
    assert.ok(preview.triangles > 0 && preview.width > 1 && preview.height > 1);
    await page.screenshot({ path: `verification/screenshots/${id}-collection.png` });
    await page.waitForFunction(previous => window.__veilstrikeLobby.fighters[0].mixer.time > previous,
      preview.animationTime);
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
    await ready('.game-lobby > .lobby-scene[data-ready="true"]');
    await page.screenshot({ path: `verification/screenshots/${id}-lobby.png` });
    assert.equal(await page.locator('.preview-fallback').count(), 0);
    await page.locator('.lobby-play').click({ noWaitAfter: true });
    await page.waitForFunction(() => window.__veilstrike?.renderer.fighters.every(f => !!f.model), null, { timeout: 120000 });
    await page.evaluate(async () => { await window.__veilstrike.renderer.ready; });
    await page.locator('.duel-loading').waitFor({ state: 'detached', timeout: 120000 });
    const match = await page.evaluate(() => ({
      fighters: window.__veilstrike.renderer.fighters.map(f => ({ id: f.id, loaded: !!f.model, source: f.modelSource })),
      phase: window.__veilstrike.getSnapshot().phase, error: document.querySelector('.duel-error')?.textContent,
      timer: window.__veilstrike.getSnapshot().timer
    }));
    assert.equal(match.fighters[0].id, id); assert.ok(!match.error); assert.ok(['intro', 'fight'].includes(match.phase));
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyJ');
    await page.waitForTimeout(450);
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyJ');
    await page.screenshot({ path: `verification/screenshots/${id}-match.png` });
    checks.push({ id, preview, match }); console.log(JSON.stringify(checks.at(-1)));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'LEAVE ARENA', exact: true }).click();
    await ready('.game-lobby > .lobby-scene[data-ready="true"]');
  }
  await page.getByRole('button', { name: 'Change game mode', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.battle-mode-card img')].every(i => i.complete && i.naturalWidth > 0));
  const modes = await page.locator('.battle-mode-card img').evaluateAll(images => images.map(i => ({ src: i.getAttribute('src'), width: i.naturalWidth })));
  assert.equal(modes.length, 3);
  await page.screenshot({ path: 'verification/screenshots/modes-fixed.png' });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile('verification/fighter-check.json', JSON.stringify({ base, checks, modes, errors }, null, 2));
  console.log('PASS: animated lobby and collection previews, playable matches for all three fighters, and all mode images.');
} catch (error) {
  await page.screenshot({ path: 'verification/screenshots/fighter-check-failure.png' }).catch(() => {});
  await writeFile('verification/fighter-check.json', JSON.stringify({ base, checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
