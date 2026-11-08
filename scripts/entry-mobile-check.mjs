import { chromium } from 'playwright';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.REVIEW_URL || 'http://localhost:5173/';
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (await readdir(cache)).filter(n => /^chromium-[0-9]+$/.test(n)).sort().reverse().map(n => join(cache, n, 'chrome-win64', 'chrome.exe')).find(existsSync);
await mkdir('verification/screenshots/entry', { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const checks = [], errors = [], evidence = {};
const check = (name, passed, detail) => { checks.push({ name, passed: !!passed, ...(detail === undefined ? {} : { detail }) }); console.log((passed ? 'PASS ' : 'FAIL ') + name); assert.ok(passed, name + (detail === undefined ? '' : ': ' + JSON.stringify(detail))); };
const profileKey = 'veilstrike:profile:v1';
function returning(name = 'Mobile', fighter = 'karen', combat = true) {
  return { version: 1, name, id: 'CHECK123', embers: 1500, matches: 0, wins: 0, selectedFighter: fighter, onboarding: { setup: true, lobby: true, combat }, levels: { karen: 1, taren: 1, nomet: 1 }, claimed: [], daily: { day: '', matches: 0, firstWin: false, threeMatches: false } };
}
async function context(options = {}, profile) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ...options });
  if (profile) await ctx.addInitScript(({ profileKey, profile }) => {
    if (!localStorage.getItem(profileKey)) localStorage.setItem(profileKey, JSON.stringify(profile));
  }, { profileKey, profile });
  await ctx.addInitScript(() => {
    window.__entryTrace = { progress: [], intro: [], sawIntro: false, sawCombatTour: false };
    let lastProgress = -1;
    const sample = () => {
      const root = document.querySelector('.entry-shell');
      const progress = Number(root?.getAttribute('data-lobby-progress'));
      if (root && progress !== lastProgress) { lastProgress = progress; window.__entryTrace.progress.push({ value: progress, at: performance.now() }); }
      const intro = document.querySelector('.match-intro');
      if (intro) {
        window.__entryTrace.sawIntro = true;
        if (window.__entryTrace.intro.length < 250) window.__entryTrace.intro.push({ at: performance.now(), revealed: intro.dataset.revealed, ready: intro.dataset.arenaReady, opponent: intro.dataset.opponent, reel: getComputedStyle(document.querySelector('.rival-reel') || intro).transform, ring: getComputedStyle(document.querySelector('.rival-spinner-ring') || intro).transform, simulationTime: window.__veilstrike?.getSnapshot().time, actualOpponent: window.__veilstrike?.getSnapshot().fighters[1].id });
      }
      if (document.querySelector('.combat-tour[open]')) window.__entryTrace.sawCombatTour = true;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  return ctx;
}
async function pageIn(ctx) {
  const page = await ctx.newPage(); page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return page;
}
async function shot(page, name) { await page.screenshot({ path: 'verification/screenshots/entry/' + name + '.png' }); }
async function lobby(page) { await page.waitForFunction(() => document.querySelector('.entry-shell')?.dataset.lobbyReady === 'true'); await page.locator('.lobby-play').waitFor({ state: 'visible' }); }
async function tour(page, kind) {
  await page.locator('.' + kind + '-tour[open]').waitFor();
  const messages = [];
  for (let i = 0; i < (kind === 'lobby' ? 7 : 6); i++) {
    messages.push(await page.locator('.tour-message').innerText());
    await page.locator('.tour-next').click();
  }
  await page.locator('.' + kind + '-tour').waitFor({ state: 'detached' }); return messages;
}
async function fight(page) {
  await page.locator('.match-intro').waitFor({ state: 'detached' });
  await page.locator('.duel-loading').waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.__veilstrike?.getSnapshot().phase === 'fight' && window.__veilstrikeAudio.roundReleased(1));
}
async function scenario(name, fn) {
  console.log('SCENARIO ' + name);
  try { await fn(); } catch (e) { checks.push({ name, passed: false, detail: e.stack || e.message }); console.error(e.stack || e.message); process.exitCode = 1; }
}

try {
  await scenario('first-time entry, home, guide, reveal and controls', async () => {
    const ctx = await context(), page = await pageIn(ctx);
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('.home-play').click();
      check('first-time name and three fighter cards', await page.locator('.starter-card').count() === 3);
      await page.waitForFunction(() => [...document.querySelectorAll('.starter-card img')].every(i => i.complete && i.naturalWidth > 0));
      check('all starter portraits render', true);
      await page.locator('#new-player-name').fill('First Fighter');
      await page.locator('.starter-card').filter({ hasText: 'TAREN' }).click();
      await page.getByRole('button', { name: 'ENTER LOBBY' }).click();
      await lobby(page);
      check('loading enters lobby automatically', await page.locator('.entry-curtain').count() === 0 && page.url().endsWith('#lobby'));
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), profileKey);
      check('welcome gift and selected name/fighter are saved', saved.embers === 1500 && saved.name === 'First Fighter' && saved.selectedFighter === 'taren', saved);
      const lobbyMessages = await tour(page, 'lobby');
      check('lobby tour includes the 1500 Ember gift', lobbyMessages.some(s => s.includes('1,500')));
      const percentages = await page.evaluate(() => window.__entryTrace.progress.map(p => p.value));
      check('loading percentage advances to 100', percentages.includes(100) && percentages.some(p => p > 0 && p < 100), percentages);
      evidence.firstLoad = await page.evaluate(() => window.__entryTrace.progress);
      await shot(page, 'lobby');
      await page.getByRole('button', { name: 'Characters', exact: true }).click();
      check('five available fighters and five coming soon', await page.locator('.roster-choice:not(:disabled)').count() === 5 && await page.locator('.roster-choice:disabled').count() === 5);
      await page.waitForFunction(() => [...document.querySelectorAll('.roster-choice:not(:disabled) img')].every(i => i.complete && i.naturalWidth > 0));
      check('available fighter cards all have portraits', true);
      await page.getByRole('button', { name: 'Close panel', exact: true }).click();
      await page.evaluate(() => { window.__savedLobbyRenderer = window.__veilstrikeLobby; });
      await page.getByRole('link', { name: 'Veilstrike home' }).click();
      await page.locator('.game-home.has-world').waitFor();
      check('live home reuses the prepared arena renderer', await page.evaluate(() => window.__veilstrikeLobby === window.__savedLobbyRenderer && window.__veilstrikeLobby.backdrop));
      check('home hero fits one viewport', await page.evaluate(() => document.querySelector('.game-home').getBoundingClientRect().height <= innerHeight + 1));
      check('home branding and current favicon', (await page.locator('.home-credit').innerText()).includes('Eminent') && await page.locator('link[rel=icon][type="image/svg+xml"]').getAttribute('href') === '/favicon.svg');
      await shot(page, 'home');
      await page.getByRole('link', { name: 'Game guide', exact: true }).click();
      await page.locator('.guide-content').waitFor();
      const time = await page.evaluate(() => window.__veilstrikeLobby.time);
      await page.waitForTimeout(250);
      check('guide pauses background arena work', await page.evaluate(t => window.__veilstrikeLobby.time === t, time));
      const guide = await page.locator('.guide-content').innerText();
      check('guide covers fighters, controls, arenas and Quick Match', ['Characters', 'Controls', 'Arenas', 'Quick Match', 'joystick'].every(s => guide.includes(s)) && !/AI DUEL/i.test(guide));
      await page.goto(base + '#home', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'FAQs', exact: true }).click();
      await page.locator('.faq-content').waitFor();
      await page.locator('.faq-content summary').filter({ hasText: 'Are more fighters' }).click();
      check('FAQ states five fighters and more coming soon', (await page.locator('.faq-content').innerText()).includes('Five fighters are available now'));
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.locator('.home-play').click(); await lobby(page);
      check('returning entry skips saved setup and lobby tour', await page.locator('.first-time-setup,.lobby-tour').count() === 0);
      await page.locator('.lobby-play').click();
      await page.locator('.match-intro').waitFor();
      await shot(page, 'shuffle');
      await page.locator('.combat-tour[open]').waitFor();
      const intro = await page.evaluate(() => window.__entryTrace.intro);
      const rotating = intro.filter(f => f.revealed === 'false');
      check('shuffle moves over actual rendered frames', new Set(rotating.map(f => f.reel)).size >= 3 && new Set(rotating.map(f => f.ring)).size >= 3, { frames: rotating.length, reelTransforms: new Set(rotating.map(f => f.reel)).size });
      const revealed = intro.filter(f => f.revealed === 'true');
      check('opponent reveal matches arena fighter', revealed.length > 0 && revealed.every(f => f.opponent === f.actualOpponent), revealed.at(-1));
      check('arena renders behind reveal before transition', revealed.some(f => f.ready === 'true'));
      check('combat stays frozen during opponent reveal', intro.filter(f => f.simulationTime !== undefined).every(f => f.simulationTime === 0));
      evidence.matchup = intro;
      const frozen = await page.evaluate(() => window.__veilstrike.getSnapshot().time);
      await page.waitForTimeout(300);
      check('combat tutorial freezes the simulation', await page.evaluate(t => window.__veilstrike.getSnapshot().time === t, frozen));
      await tour(page, 'combat'); await fight(page);
      const before = await page.evaluate(() => window.__veilstrike.getSnapshot().fighters[0]);
      await page.keyboard.down('KeyW'); await page.waitForTimeout(350); await page.keyboard.up('KeyW');
      const after = await page.evaluate(() => window.__veilstrike.getSnapshot().fighters[0]);
      check('movement works after tutorial and voiced round intro', Math.hypot(after.x - before.x, after.z - before.z) > .1);
      await page.keyboard.press('Escape');
      const pauseTime = await page.evaluate(() => window.__veilstrike.getSnapshot().time);
      await page.waitForTimeout(250);
      check('match menu pauses Quick Match', await page.evaluate(t => window.__veilstrike.getSnapshot().time === t, pauseTime));
      await shot(page, 'arena-paused');
      await page.getByRole('button', { name: 'LEAVE ARENA', exact: true }).click(); await lobby(page);
      await page.reload({ waitUntil: 'domcontentloaded' }); await lobby(page);
      const returningProfile = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), profileKey);
      check('reload preserves all tutorial flags without awarding again', returningProfile.embers === 1500 && Object.values(returningProfile.onboarding).every(Boolean));
      await page.getByRole('button', { name: 'Audio settings', exact: true }).click();
      check('audio settings retain only Sound and Effects', await page.locator('.audio-settings input[type=range]').count() === 2);
      await page.getByRole('button', { name: 'Close panel', exact: true }).click();
      evidence.audio = await page.evaluate(() => window.__veilstrikeAudio.status());
    } finally { await ctx.close(); }
  });

  await scenario('direct lobby link loads without returning home', async () => {
    const ctx = await context({}, returning('Direct')), page = await pageIn(ctx);
    try {
      await page.goto(base + '#lobby', { waitUntil: 'domcontentloaded' }); await lobby(page);
      check('direct returning lobby link automatically renders', await page.locator('.entry-curtain,.first-time-setup,.lobby-tour').count() === 0);
      evidence.directLoad = await page.evaluate(() => window.__entryTrace.progress);
    } finally { await ctx.close(); }
  });

  await scenario('mobile joystick, aligned action circles and home rotation', async () => {
    const ctx = await context({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, returning()), page = await pageIn(ctx);
    try {
      await ctx.addInitScript(() => {
        window.__orientationCalls = []; let fullscreen = null;
        Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
        Element.prototype.requestFullscreen = async function () { window.__orientationCalls.push({ type: 'fullscreen', route: location.hash || '#home' }); fullscreen = this; document.dispatchEvent(new Event('fullscreenchange')); };
        document.exitFullscreen = async () => { fullscreen = null; document.dispatchEvent(new Event('fullscreenchange')); };
        Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async value => { window.__orientationCalls.push({ type: 'lock', value, allowed: !!fullscreen, route: location.hash || '#home' }); if (!fullscreen) throw new DOMException('Fullscreen required', 'NotAllowedError'); } });
        Object.defineProperty(screen.orientation, 'unlock', { configurable: true, value: () => window.__orientationCalls.push({ type: 'unlock' }) });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await shot(page, 'mobile-home');
      await page.locator('.home-play').tap(); await lobby(page);
      const orientation = await page.evaluate(() => window.__orientationCalls);
      check('landscape request starts from first home touch', orientation.some(c => c.type === 'fullscreen' && c.route === '#home') && orientation.some(c => c.type === 'lock' && c.value === 'landscape' && c.allowed), orientation);
      await page.locator('.lobby-play').tap(); await fight(page);
      check('mobile has joystick and seven round actions, without Guard', await page.locator('.duel-joystick').isVisible() && await page.locator('.duel-touch-action').count() === 7 && await page.locator('.duel-touch .touch-guard').count() === 0 && await page.locator('.duel-touch-dpad').count() === 0);
      const layout = async () => page.evaluate(() => {
        const buttons = [...document.querySelectorAll('.duel-touch-action')].map(b => { const r = b.getBoundingClientRect(); return { name: b.className, x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2, radius: getComputedStyle(b).borderRadius }; });
        const b = label => buttons.find(b => b.name.includes('touch-' + label));
        return { width: innerWidth, height: innerHeight, buttons, diamond: Math.abs(b('jump').cx - b('dodge').cx) < 1 && Math.abs(b('grab').cy - b('attack').cy) < 1 && Math.abs(b('jump').cx - (b('grab').cx + b('attack').cx) / 2) < 1, bounds: buttons.every(b => b.x >= 0 && b.y >= 0 && b.x + b.width <= innerWidth + 1 && b.y + b.height <= innerHeight + 1), targets: buttons.every(b => b.width >= 44 && b.height >= 44 && b.radius === '50%'), separate: buttons.every((a, i) => buttons.slice(i + 1).every(b => Math.hypot(a.cx - b.cx, a.cy - b.cy) >= (a.width + b.width) / 2)), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      for (const [width, height, name] of [[390, 844, 'mobile-390'], [320, 720, 'mobile-320'], [844, 390, 'mobile-landscape']]) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(250);
        const geometry = await layout();
        check('aligned circular controls fit ' + width + 'x' + height, geometry.diamond && geometry.bounds && geometry.targets && geometry.separate && !geometry.overflow, geometry);
        evidence[name] = geometry; await shot(page, name);
      }
      await page.evaluate(() => {
        const api = window.__veilstrike, sim = api.simulation;
        sim.config.mode = 'pvp'; sim.fighters[1].x = 8; sim.fighters[1].z = -8;
        window.__moves = []; window.__samples = [];
        const move = api.input.move.bind(api.input), sample = api.input.sample.bind(api.input);
        api.input.move = (right, forward) => { window.__moves.push({ right, forward, at: performance.now() }); move(right, forward); };
        api.input.sample = (...args) => { const result = sample(...args); window.__samples.push({ ...result, at: performance.now() }); if (window.__samples.length > 300) window.__samples.shift(); return result; };
      });
      const cdp = await ctx.newCDPSession(page);
      const rect = await page.locator('.duel-joystick').boundingBox(), center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 };
      const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      await send('touchStart', [center]);
      await send('touchMove', [{ ...center, x: center.x + 1 }]);
      check('joystick dead zone prevents drift', await page.evaluate(() => { const m = window.__moves.at(-1); return m.right === 0 && m.forward === 0; }));
      await send('touchMove', [{ ...center, x: center.x + rect.width * .1 }]);
      const partial = await page.evaluate(() => window.__moves.at(-1));
      check('joystick supports partial movement strength', Math.hypot(partial.right, partial.forward) > 0 && Math.hypot(partial.right, partial.forward) < .8, partial);
      const full = { ...center, x: center.x + rect.width, y: center.y - rect.width };
      await send('touchMove', [full]);
      const maximal = await page.evaluate(() => window.__moves.at(-1));
      check('joystick clamps diagonal movement to unit strength', Math.abs(Math.hypot(maximal.right, maximal.forward) - 1) < .001, maximal);
      const sprintRect = await page.locator('.touch-sprint').boundingBox(), sprint = { x: sprintRect.x + sprintRect.width / 2, y: sprintRect.y + sprintRect.height / 2, id: 2 };
      await send('touchStart', [full, sprint]); await page.waitForTimeout(200);
      check('movement and Sprint work with independent touches', await page.evaluate(() => window.__samples.some(s => s.sprint && Math.hypot(s.x, s.z) > .8)));
      await send('touchEnd', [full]); await page.waitForTimeout(50);
      check('releasing action touch keeps joystick movement', await page.evaluate(() => { const s = window.__samples.at(-1); return !s.sprint && Math.hypot(s.x, s.z) > .8; }));
      await send('touchEnd', []);
      check('joystick release clears movement', await page.evaluate(() => { const m = window.__moves.at(-1); return m.right === 0 && m.forward === 0 && document.querySelector('.duel-joystick').dataset.moving === 'false'; }));
      await send('touchStart', [center]); await send('touchMove', [full]); await send('touchCancel', []);
      check('pointer cancellation resets the joystick', await page.evaluate(() => window.__moves.at(-1).right === 0 && document.querySelector('.duel-joystick').dataset.moving === 'false'));
      await send('touchStart', [center]); await send('touchMove', [full]);
      await page.keyboard.press('Escape');
      check('pausing clears and disables mobile controls', await page.evaluate(() => window.__moves.at(-1).right === 0 && [...document.querySelectorAll('.duel-touch-action')].every(b => b.disabled)));
      await send('touchEnd', []);
      await page.getByRole('button', { name: 'RETURN TO FIGHT', exact: true }).click();
      await page.locator('.touch-attack').tap(); await page.waitForTimeout(300);
      check('round Attack button reaches combat input', await page.evaluate(() => window.__samples.some(s => s.light)));
      await page.evaluate(() => document.exitFullscreen());
      check('exiting fullscreen releases landscape lock', await page.evaluate(() => window.__orientationCalls.some(c => c.type === 'unlock')));
      evidence.mobileInput = await page.evaluate(() => ({ moves: window.__moves, samples: window.__samples.slice(-30) }));
      await cdp.detach();
    } finally { await ctx.close(); }
  });

  await scenario('reduced motion and unsupported mobile orientation', async () => {
    const ctx = await context({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }, returning('Reduced')), page = await pageIn(ctx);
    try {
      await ctx.addInitScript(() => { Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: undefined }); });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      check('unsupported rotation shows a usable home hint', await page.locator('.mobile-orientation-hint.is-home').isVisible());
      await page.locator('.home-play').tap(); await lobby(page);
      await page.locator('.lobby-play').tap(); await fight(page);
      const frames = await page.evaluate(() => window.__entryTrace.intro);
      check('reduced motion skips the fast shuffle', frames.length > 0 && frames.every(f => f.revealed === 'true'));
      check('portrait remains playable without orientation support', await page.locator('.duel-joystick').isVisible() && await page.locator('.touch-attack').isEnabled());
      await shot(page, 'mobile-reduced');
    } finally { await ctx.close(); }
  });

  await scenario('two real PvP clients exclude reveal and onboarding', async () => {
    const hostContext = await context({}, returning('Host', 'karen', false)), guestContext = await context({}, returning('Guest', 'taren', false));
    const host = await pageIn(hostContext), guest = await pageIn(guestContext);
    try {
      for (const page of [host, guest]) {
        await page.goto(base + '#lobby', { waitUntil: 'domcontentloaded' }); await lobby(page);
        await page.locator('.mode-selector').click(); await page.locator('.battle-mode-card').filter({ hasText: 'ONLINE PVP' }).click();
        await page.getByRole('button', { name: /CONFIRM BATTLE/ }).click(); await page.locator('.lobby-play').click();
      }
      await host.getByRole('button', { name: 'CREATE ARENA', exact: true }).click();
      await host.locator('.room-code strong').waitFor(); const code = await host.locator('.room-code strong').innerText();
      await guest.getByRole('textbox', { name: 'Room code', exact: true }).fill(code); await guest.getByRole('button', { name: 'JOIN ARENA', exact: true }).click();
      await host.getByRole('button', { name: 'READY TO DUEL', exact: true }).waitFor({ state: 'visible' });
      await host.getByRole('button', { name: 'READY TO DUEL', exact: true }).click(); await guest.getByRole('button', { name: 'READY TO DUEL', exact: true }).click();
      await fight(host); await fight(guest);
      check('both PvP browsers bypass reveal and combat tutorial', await host.evaluate(() => !window.__entryTrace.sawIntro && !window.__entryTrace.sawCombatTour) && await guest.evaluate(() => !window.__entryTrace.sawIntro && !window.__entryTrace.sawCombatTour));
      const a = await host.evaluate(() => window.__veilstrike.getSnapshot()), b = await guest.evaluate(() => window.__veilstrike.getSnapshot());
      check('PvP opponents and rounds stay synchronized', a.fighters[0].id === b.fighters[0].id && a.fighters[1].id === b.fighters[1].id && a.round === b.round && a.phase === 'fight' && b.phase === 'fight');
      await shot(host, 'pvp-host'); evidence.pvp = { host: a.fighters.map(f => f.id), guest: b.fighters.map(f => f.id), round: a.round };
    } finally { await hostContext.close(); await guestContext.close(); }
  });
  check('browser checks have no application errors', errors.length === 0, errors);
} finally {
  await writeFile('verification/browser-check.json', JSON.stringify({ checks, errors, evidence }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, errors }, null, 2));
