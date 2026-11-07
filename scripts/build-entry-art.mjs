import { chromium } from 'playwright';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const origin = process.env.VEILSTRIKE_PREVIEW_URL ?? 'http://localhost:5173';
const output = 'verification/screenshots/entry/portraits';
await mkdir(output, { recursive: true });
await mkdir('apps/web/public/images/fighters', { recursive: true });
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath && process.env.LOCALAPPDATA) {
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
  const folders = await readdir(cache).catch(() => []);
  for (const folder of folders.filter(name => /^chromium-[0-9]+$/.test(name)).sort().reverse()) {
    const candidate = join(cache, folder, 'chrome-win64', 'chrome.exe');
    if (existsSync(candidate)) { executablePath = candidate; break; }
  }
}
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const appErrors = [];
page.on('pageerror', error => appErrors.push(error.message));
const assets = [];
const allFighters = ['karen', 'taren', 'nomet', 'veyra', 'mawren'];
const chosenFighter = process.argv.find(value => value.startsWith('--fighter='))?.split('=')[1];
if (chosenFighter && !allFighters.includes(chosenFighter)) throw new Error('Choose a currently playable fighter.');
function optimizeImage(source, target, quality) {
  const conversion = spawnSync('python', ['-c', "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=int(sys.argv[3]), method=6)", source, target, String(quality)], { encoding: 'utf8' });
  if (conversion.status !== 0) throw new Error(conversion.stderr || 'Portrait conversion failed.');
}
try {
  // Capture the actual game renderer in a same-origin page without the app's HMR connection.
  await page.route('**/__entry-art.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#0d1721"></body></html>' }));
  await page.goto(origin + '/__entry-art.html', { waitUntil: 'domcontentloaded' });
  for (const id of chosenFighter ? [chosenFighter] : allFighters) {
    const result = await page.evaluate(async id => {
      const [{ DuelRenderer }, { DuelSimulation }, { CHAMPIONS }] = await Promise.all([
        import('/src/duel/DuelRenderer.ts'), import('/src/duel/simulation.ts'), import('/src/duel/catalog.ts'),
      ]);
      const config = { player: id, opponent: id === 'karen' ? 'taren' : 'karen', arena: 'sanctum', mode: 'practice', difficulty: 'initiate', playerLevel: 1 };
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;inset:0;width:480px;height:640px';
      document.body.append(host);
      const stage = new DuelRenderer(host, config, true, false);
      try {
        await stage.ready;
        const snapshot = new DuelSimulation(config).snapshot();
        stage.inspection = true;
        for (let i = 0; i < 16; i++) stage.render(snapshot, 1 / 30);
        const height = 2.45 * CHAMPIONS[id].size;
        stage.scene.background.set('#172735');
        stage.scene.fog.density = .075;
        stage.renderer.setPixelRatio(1); stage.renderer.setSize(480, 640, false);
        stage.camera.aspect = 480 / 640; stage.camera.fov = 36; stage.camera.updateProjectionMatrix();
        stage.camera.position.set((id === 'taren' ? -.55 : .16) * height, .7 * height, 1.72 * height);
        stage.camera.lookAt(0, .55 * height, 0);
        stage.renderer.render(stage.scene, stage.camera);
        return { png: stage.renderer.domElement.toDataURL('image/png').split(',')[1], model: stage.fighters[0].modelSource, height };
      } finally { stage.destroy(); host.remove(); }
    }, id);
    await writeFile(join(output, id + '.png'), Buffer.from(result.png, 'base64'));
    optimizeImage(join(output, id + '.png'), 'apps/web/public/images/fighters/' + id + '.webp', 88);
    assets.push({ id, source: result.model, height: result.height, portrait: 'images/fighters/' + id + '.webp' });
    console.log('Captured ' + id + ' from the current ' + result.model + ' fighter.');
  }
  const world = await page.evaluate(async () => {
    const [{ DuelRenderer }, { DuelSimulation }] = await Promise.all([import('/src/duel/DuelRenderer.ts'), import('/src/duel/simulation.ts')]);
    const config = { player: 'karen', opponent: 'taren', arena: 'sanctum', mode: 'practice', difficulty: 'initiate' };
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;width:1600px;height:1000px'; document.body.append(host);
    const stage = new DuelRenderer(host, config, true, false);
    try {
      await stage.ready;
      stage.renderer.setPixelRatio(1); stage.renderer.setSize(1600, 1000, false);
      stage.camera.aspect = 1.6; stage.setBackdrop(true);
      stage.render(new DuelSimulation(config).snapshot(), 0);
      return stage.renderer.domElement.toDataURL('image/png').split(',')[1];
    } finally { stage.destroy(); host.remove(); }
  });
  await writeFile(join(output, 'sanctum.png'), Buffer.from(world, 'base64'));
  optimizeImage(join(output, 'sanctum.png'), 'apps/web/public/images/entry-sanctum.webp', 82);
  const icons = await page.evaluate(async origin => {
    const img = new Image();
    const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    img.src = origin + '/favicon.svg'; await loaded;
    return [32, 180].map(size => {
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      return { size, png: canvas.toDataURL('image/png').split(',')[1] };
    });
  }, origin);
  for (const { size, png } of icons) await writeFile('apps/web/public/' + (size === 32 ? 'favicon.png' : 'apple-touch-icon.png'), Buffer.from(png, 'base64'));
  const previous = JSON.parse(await readFile('verification/entry-art.json', 'utf8').catch(() => '{}'));
  const mergedAssets = allFighters.map(id => assets.find(asset => asset.id === id) ?? previous.assets?.find(asset => asset.id === id)).filter(Boolean);
  await writeFile('verification/entry-art.json', JSON.stringify({ origin, assets: mergedAssets, rendererErrors: appErrors, note: 'Portraits and fallback world captured from current live game models; no placeholder art.' }, null, 2));
  if (appErrors.length) throw new Error(appErrors.join('\n'));
  console.log('Saved ' + assets.length + ' optimized WebP portrait(s), the arena fallback, and new favicon PNGs.');
} finally { await browser.close(); }
