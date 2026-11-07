import { useEffect, useRef, useState } from 'react';
import { DuelSimulation, emptyInput } from './simulation';
import type { DuelSnapshot, Slot } from './simulation';
import { DuelRenderer } from './DuelRenderer';
import { DuelInput } from './input';
import { CHAMPIONS, ARENAS, levelHealth } from './catalog';
import type { DuelConfig } from './catalog';
import type { RoomConnection } from './network';
import type { MatchResult } from '../fight/types';
import { fightAudio } from '../fight/audio';
import { DuelSoundscape } from './audio';
import { GuidedTour } from '../entry/GuidedTour';
import { COMBAT_TOUR } from '../entry/tours';
import { MatchIntro } from '../entry/MatchIntro';

interface Props { config: DuelConfig; room?: RoomConnection | null; onExit: () => void; onComplete: (result: MatchResult) => void; active?: boolean; playerName?: string; showControlsTutorial?: boolean; onControlsTutorialComplete?: () => void; }
export function DuelGame({ config, room, onExit, onComplete, active: screenActive = true, playerName, showControlsTutorial = false, onControlsTutorialComplete }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<{ renderer: DuelRenderer; input: DuelInput; simulation: DuelSimulation | null } | null>(null);
  const callbacks = useRef({ onExit, onComplete }); callbacks.current = { onExit, onComplete };
  const needsTutorial = showControlsTutorial && config.mode === 'practice' && !room;
  const [tutorial, setTutorial] = useState(needsTutorial);
  const [entryPhase, setEntryPhase] = useState<'versus' | 'veil' | 'ready'>(() => config.mode === 'practice' && !room ? 'versus' : 'veil');
  const [arenaMounted, setArenaMounted] = useState(false);
  const entryBlocked = useRef(true); entryBlocked.current = entryPhase !== 'ready' || tutorial;
  const screenActiveRef = useRef(screenActive); screenActiveRef.current = screenActive;
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [locked, setLocked] = useState(true), [muted, setMuted] = useState(() => fightAudio.isMuted());
  const [state, setState] = useState<DuelSnapshot>(() => new DuelSimulation(config).snapshot());
  const [help, setHelp] = useState(false);
  const [highImpact,setHighImpact]=useState<number|null>(null);
  const slot: Slot = room?.slot ?? 0;
  const pause = (value: boolean) => { pausedRef.current = value; runtime.current?.input.reset(); setPaused(value); fightAudio.suspend(!screenActiveRef.current || value || document.hidden); };
  const networkReady = !room || !!room.snapshot;
  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => setArenaMounted(true)); });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, []);
  useEffect(() => {
    if (entryPhase !== 'veil' || !ready || !networkReady) return;
    const timer = window.setTimeout(() => setEntryPhase('ready'), 420);
    return () => window.clearTimeout(timer);
  }, [entryPhase, ready, networkReady]);
  useEffect(() => { runtime.current?.input.setEnabled(screenActive && !entryBlocked.current && !paused); }, [screenActive, entryPhase, tutorial, paused]);
  useEffect(() => { if (entryPhase === 'ready' && !tutorial && ready) fightAudio.startMusic('fight'); }, [entryPhase, tutorial, ready]);
  useEffect(() => {
    if (entryPhase === 'ready' && tutorial) {
      pausedRef.current = true; runtime.current?.input.reset(); setPaused(true); fightAudio.suspend(true);
    }
  }, [entryPhase, tutorial]);
  useEffect(() => {
    if (!arenaMounted) return;
    const element = host.current;
    if (!element) return;
    let renderer: DuelRenderer;
    try { renderer = new DuelRenderer(element, config); } catch { setError('Your browser could not open the 3D arena. Enable hardware acceleration and try again.'); return; }
    const simulation = room ? null : new DuelSimulation(config);
    const initialSnapshot = simulation?.snapshot() ?? new DuelSimulation(config).snapshot();
    let active = true, loaded = false, rendered = false, notifiedReady = false, frame = 0, last = performance.now(), nextHud = 0, nextNetwork = 0, complete = false, lastAudioEvent = 0, lastHudTime = -1;
    let currentSnapshot = initialSnapshot;
    let warnedRound = 0, announcedResult = false;
    const soundscape = new DuelSoundscape(config.arena, fightAudio, CHAMPIONS);
    const openMenu = () => { if (entryBlocked.current || !screenActiveRef.current) return; input.reset(); pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); fightAudio.suspend(pausedRef.current || document.hidden); };
    const input = new DuelInput(element, openMenu, () => { renderer.locked = !renderer.locked; setLocked(renderer.locked); }, () => { if (!room) { pausedRef.current = true; setPaused(true); } });
    runtime.current = { renderer, input, simulation };
    input.setEnabled(screenActiveRef.current && !entryBlocked.current && !pausedRef.current);
    if (import.meta.env.DEV) Object.assign(window, { __veilstrike: { simulation, renderer, input, pause, isPaused: () => pausedRef.current, getSnapshot: () => room?.snapshot ?? simulation?.snapshot() ?? initialSnapshot } });
    let pendingInput = emptyInput(), accumulator = 0;
    fightAudio.suspend(!screenActiveRef.current || pausedRef.current || document.hidden); fightAudio.setArena(config.arena);
    const visibility = () => { input.reset(); if (!room && document.hidden) { pausedRef.current = true; setPaused(true); } fightAudio.suspend(!screenActiveRef.current || document.hidden || pausedRef.current); };
    document.addEventListener('visibilitychange', visibility);
    const resizeObserver = new ResizeObserver(() => { rendered = false; }); resizeObserver.observe(element);
    renderer.ready.then(() => {
      if (!active) return;
      loaded = true;
    }).catch(() => { if (active) setError('A fighter model could not load. Return to the menu and try again.'); });
    const unlock = () => { void fightAudio.unlock(); };
    element.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    const tick = (now: number) => {
      if (!active) return;
      const dt = document.hidden || !screenActiveRef.current ? 0 : Math.min(.15, Math.max(0, (now - last) / 1000)); last = now;
      let snapshot = room?.snapshot ?? currentSnapshot;
      const canAdvance = screenActiveRef.current && !document.hidden && !pausedRef.current && !entryBlocked.current;
      if (loaded) {
        const sampledInput = canAdvance ? input.sample(renderer.movementBasis(), renderer.locked) : emptyInput();
        const playerInput = snapshot.phase === 'fight' && fightAudio.roundReleased(snapshot.round) ? sampledInput : emptyInput();
        if (room) {
          pendingInput.x = playerInput.x; pendingInput.z = playerInput.z; pendingInput.guard = playerInput.guard; pendingInput.sprint = playerInput.sprint; pendingInput.lockOn = playerInput.lockOn;
          for (const key of ['light','heavy','dodge','special','ultimate','jump','grapple'] as const) pendingInput[key] ||= playerInput[key];
          if (now >= nextNetwork) { room.input(pendingInput); pendingInput = emptyInput(); nextNetwork = now + 30; }
          if (room.snapshot) snapshot = { ...room.snapshot, events: room.drainEvents() };
        } else if (canAdvance) {
          pendingInput.x = playerInput.x; pendingInput.z = playerInput.z; pendingInput.guard = playerInput.guard; pendingInput.sprint = playerInput.sprint; pendingInput.lockOn = playerInput.lockOn;
          for (const key of ['light','heavy','dodge','special','ultimate','jump','grapple'] as const) pendingInput[key] ||= playerInput[key];
          accumulator += dt;
          while (accumulator >= 1 / 60) {
            simulation!.advance(1 / 60, pendingInput, undefined, fightAudio.roundReleased(simulation!.round));
            for (const key of ['light','heavy','dodge','special','ultimate','jump','grapple'] as const) pendingInput[key] = false;
            accumulator -= 1 / 60;
          }
          snapshot = simulation!.snapshot(simulation!.drainEvents());
          currentSnapshot = snapshot;
        }
      }
      // A paused arena keeps its last frame; avoid continuously redrawing static shadows and bloom.
      if (loaded && screenActiveRef.current && !document.hidden && (!rendered || canAdvance || room)) {
        renderer.render(snapshot, dt, slot); rendered = true;
        if (!notifiedReady) { notifiedReady = true; setReady(true); room?.loaded(); }
      }
      for (const event of snapshot.events) if (event.id > lastAudioEvent) { soundscape.event(event, snapshot, slot); if(event.kind==='hit'&&event.knockdown)setHighImpact(event.id);lastAudioEvent = event.id; }
      if (canAdvance) soundscape.update(snapshot, slot);
      if (snapshot.phase === 'fight' && canAdvance) {
        if (snapshot.timer <= 10 && warnedRound !== snapshot.round) { warnedRound = snapshot.round; fightAudio.announce('ten-seconds', 3); }
      }
      if (snapshot.phase === 'complete' && !announcedResult) { announcedResult = true; fightAudio.announce(snapshot.winner === null ? 'draw' : snapshot.winner === slot ? 'victory' : 'defeat', 10, true); }
      if (now >= nextHud && snapshot.time !== lastHudTime) { setState(snapshot); lastHudTime = snapshot.time; nextHud = now + 75; }
      if (snapshot.phase === 'complete' && snapshot.phaseTime > 2.5 && !complete && !room?.error) {
        complete = true;
        const won = snapshot.winner === slot;
        callbacks.current.onComplete({ won, tied: snapshot.winner === null, playerRounds: snapshot.wins[slot], botRounds: snapshot.wins[slot === 0 ? 1 : 0], finish: snapshot.timer > 0 ? 'ko' : 'timeout' });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const unsubscribe = room?.subscribe(() => { if (room.error) { input.reset(); setError(room.error); } });
    return () => {
      active = false; cancelAnimationFrame(frame); resizeObserver.disconnect(); unsubscribe?.(); input.destroy(); renderer.destroy();
      element.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', visibility);
      fightAudio.stopMusic(); runtime.current = null; pausedRef.current = false;
    };
  }, [config, room, slot, arenaMounted]);
  useEffect(() => {
    if (!screenActive) { pausedRef.current = true; runtime.current?.input.reset(); setPaused(true); fightAudio.suspend(true); fightAudio.stopMusic(); }
    else if (runtime.current) { if (entryPhase === 'ready' && !tutorial) fightAudio.startMusic('fight'); fightAudio.suspend(pausedRef.current || document.hidden); }
  }, [screenActive, entryPhase, tutorial]);

  const self = state.fighters[slot], enemy = state.fighters[slot === 0 ? 1 : 0];
  const player = CHAMPIONS[self.id], opponent = CHAMPIONS[enemy.id];
  const banner = state.phase === 'intro' ? 'ROUND ' + state.round : state.phase === 'fight' && state.phaseTime < .55 ? 'FIGHT' : state.phase === 'roundEnd' ? (state.winner === null ? 'STALEMATE' : state.winner === slot ? 'ROUND VICTORY' : 'ROUND DEFEAT') : state.phase === 'complete' ? (state.winner === null ? 'DRAW' : state.winner === slot ? 'VICTORY' : 'DEFEAT') : '';
  const inject = (code: string, down: boolean) => runtime.current?.input.inject(code, down);
  return <main className="duel-game">
    <div ref={host} className="duel-render-host" />
    <div className="duel-vignette" aria-hidden="true" />
    {highImpact!==null&&<div key={highImpact} className="duel-high-impact" aria-live="polite">HIGH IMPACT</div>}
    <div className="duel-interface" inert={entryPhase !== 'ready'} aria-hidden={entryPhase !== 'ready'}>
    <header className="duel-hud">
      <HealthBar name={playerName || player.name} title={player.title} hp={self.hp / levelHealth(self.id, slot === 0 ? config.playerLevel : config.opponentLevel)} stamina={self.stamina / player.stamina} wins={state.wins[slot]} />
      <div className="duel-clock"><small>ROUND {state.round}</small><strong>{Math.ceil(state.timer)}</strong><span>{config.mode === 'practice' ? 'QUICK MATCH' : 'PVP DUEL'}</span></div>
      <HealthBar name={opponent.name} title={room ? 'OPPONENT' : opponent.title} hp={enemy.hp / levelHealth(enemy.id, slot === 0 ? config.opponentLevel : config.playerLevel)} stamina={enemy.stamina / opponent.stamina} wins={state.wins[slot === 0 ? 1 : 0]} enemy />
    </header>
    <div className="duel-location"><span>{ARENAS[config.arena].name}</span>{config.mode === 'practice' && <small>{state.aiIntent}</small>}</div>
    <div className="duel-toolbar"><button onClick={() => setMuted(fightAudio.toggle())}>{muted ? 'SOUND OFF' : 'SOUND ON'}</button><button aria-pressed={locked} onClick={() => { if (runtime.current) { runtime.current.renderer.locked = !locked; setLocked(!locked); } }}>{locked ? 'LOCK ON' : 'FREE CAMERA'}</button><button onClick={() => pause(true)}>ESC · MENU</button></div>
    {banner && ready && entryPhase === 'ready' && !tutorial && <div className={'duel-banner ' + (state.phase === 'roundEnd' || state.phase === 'complete' ? 'duel-banner-result' : '')}><span>{banner}</span>{state.phase === 'roundEnd' && <small>{state.wins[slot]} : {state.wins[slot === 0 ? 1 : 0]}</small>}</div>}
    <footer className="duel-bottom">
      <div className="duel-abilities">
        <button disabled={self.specialCooldown > 0 || self.stamina < player.moves.special.stamina || !ready || paused} onClick={() => runtime.current?.input.pulse('KeyU')}><kbd>U</kbd><span>{player.specialName}</span><small>{self.specialCooldown > 0 ? self.specialCooldown.toFixed(1) + 's' : self.stamina < player.moves.special.stamina ? 'LOW STAMINA' : 'READY'}</small></button>
        <button disabled={self.charge < 1 || !ready || paused} onClick={() => runtime.current?.input.pulse('KeyI')}><kbd>I</kbd><span>{player.ultimateName}</span><small>{self.charge >= 1 ? 'READY' : Math.round(self.charge * 100) + '%'}</small></button>
        <div className="soul-meter" aria-label="Soul charge"><i style={{ width: self.charge * 100 + '%' }} /></div>
      </div>
      <div className="duel-controls-legend"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SPACE</kbd> DODGE</span><span><kbd>J / CLICK</kbd> ATTACK · DOUBLE FOR HEAVY</span><span><kbd>L</kbd> GUARD / PARRY</span><span><kbd>SHIFT</kbd> SPRINT</span><button onClick={() => { setHelp(true); pause(true); }}>CONTROLS</button></div>
    </footer>
    <div className="duel-touch">
      <div className="duel-touch-dpad"><Touch code="KeyW" label="↑" inject={inject}/><Touch code="KeyA" label="←" inject={inject}/><Touch code="KeyS" label="↓" inject={inject}/><Touch code="KeyD" label="→" inject={inject}/></div>
      <div className="duel-touch-actions"><Touch code="KeyL" label="GUARD" inject={inject}/><Touch code="Space" label="DODGE" inject={inject}/><Touch code="KeyJ" label="ATTACK" inject={inject}/><Touch code="KeyC" label="JUMP" inject={inject}/><Touch code="KeyE" label="GRAB" inject={inject}/><Touch code="ShiftLeft" label="SPRINT" inject={inject}/><small>Double tap Attack for heavy</small></div>
    </div>
    </div>
    {entryPhase === 'versus' && !error && <MatchIntro config={config} playerName={playerName || CHAMPIONS[config.player].name} ready={ready} onComplete={() => setEntryPhase('veil')} onExit={onExit}/>}
    {entryPhase !== 'versus' && (entryPhase === 'veil' || !ready || (room && !room.snapshot)) && !error && <div className="duel-overlay duel-loading"><div className="loading-mark"/><strong>{ready && room && !room.snapshot ? 'WAITING FOR YOUR OPPONENT' : 'ENTERING THE VEIL'}</strong><span>{ready ? room && !room.snapshot ? 'Both fighters enter together.' : 'Your fighters and arena are ready.' : 'Preparing the arena and your fighter.'}</span></div>}
    {((paused && !tutorial) || error) && <div className="duel-overlay"><section className="duel-pause"><p>{error ? 'CONNECTION INTERRUPTED' : help ? 'YOUR MOVESET' : 'THE ARENA'}</p><h2>{error ? 'The duel is on hold.' : help ? 'Read. React. Strike.' : room ? 'Leave the duel?' : 'Take a breath.'}</h2>{error ? <div className="duel-error" role="alert">{error}</div> : help ? <div className="control-guide"><span>W / A / S / D <b>Move in the arena</b></span><span>Space <b>Dodge with invulnerability</b></span><span>Shift <b>Sprint; drains stamina</b></span><span>J / Left click <b>One press: light · Two quick presses: heavy</b></span><span>L / Right click <b>Hold guard; tap for parry</b></span><span>U / I <b>Signature ability / ultimate</b></span><span>C <b>Jump</b></span><span>E <b>Grab and throw at close range</b></span><span>Tab <b>Toggle target lock</b></span></div> : <span>{room ? 'The online match continues while this menu is open.' : 'The fight resumes when you are ready.'}</span>}<div className="pause-actions">{!error && <button className="duel-primary" onClick={() => { setHelp(false); pause(false); }}>RETURN TO FIGHT</button>}<button className="duel-secondary" onClick={onExit}>LEAVE ARENA</button></div></section></div>}
    {tutorial && entryPhase === 'ready' && ready && screenActive && !error && <GuidedTour kind="combat" stops={COMBAT_TOUR} values={{ special: player.specialName, ultimate: player.ultimateName }} finalLabel="START FIGHTING" onComplete={() => { setTutorial(false); pause(false); onControlsTutorialComplete?.(); }}/>}
  </main>;
}
function HealthBar({ name, title, hp, stamina, wins, enemy = false }: { name: string; title: string; hp: number; stamina: number; wins: number; enemy?: boolean }) {
  return <div className={'duel-health ' + (enemy ? 'is-enemy' : '')}><div className="health-heading"><strong>{name}</strong><small>{title}</small><span className="round-seals" aria-label={wins + ' rounds won'}>{[0, 1].map(i => <i key={i} className={i < wins ? 'won' : ''}/>)}</span></div><div className="health-track" role="progressbar" aria-label={name + ' health'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hp * 100)}><i style={{ width: Math.max(0, hp) * 100 + '%' }}/></div><div className="stamina-track" role="progressbar" aria-label={name + ' stamina'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stamina * 100)}><i style={{ width: stamina * 100 + '%' }}/></div></div>;
}
function Touch({ code, label, inject }: { code: string; label: string; inject: (code: string, down: boolean) => void }) {
  return <button onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); inject(code, true); }} onPointerUp={() => inject(code, false)} onPointerCancel={() => inject(code, false)} onLostPointerCapture={() => inject(code, false)}>{label}</button>;
}


