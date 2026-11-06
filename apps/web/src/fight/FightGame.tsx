import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';

import { FightScene } from './FightScene';
import { fightAudio } from './audio';
import { ThreeStage } from './ThreeStage';
import type { Difficulty, FighterId, MatchResult } from './types';
import { CombatBridge } from './combatEvents';
import { createVeilstrikeRoom } from '../flaunch';

interface FightGameProps {
  player: FighterId;
  opponent: FighterId;
  difficulty: Difficulty;
  onExit: () => void;
  onComplete: (result: MatchResult) => void;
}

export function FightGame(props: FightGameProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<CombatBridge | null>(null);
  const [hud, setHud] = useState({ playerHealth: 1, botHealth: 1, playerCharge: 0, timer: 60, round: 1, banner: '' });
  const [showHelp, setShowHelp] = useState(true);
  const [stageReady, setStageReady] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    void orientation.lock?.('landscape').catch(() => undefined);
    const helpTimer = window.setTimeout(() => setShowHelp(false), 8500);
    // Browsers require a user gesture before audio can play. Start immediately
    // when allowed, then retry on the first interaction if the context was gated.
    fightAudio.startMusic('fight');
    const unlockAudio = () => {
      void fightAudio.unlock().then(() => fightAudio.startMusic('fight'));
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    const bridge = new CombatBridge();
    bridgeRef.current = bridge;
    const room = createVeilstrikeRoom();
    const score = (type: 'hit' | 'special' | 'win') => { void room.send({ type }); };
    const scoreOff = [
      bridge.events.on('hit', (event) => { if (event.attacker === 'player') score('hit'); }),
      bridge.events.on('special', (event) => { if (event.side === 'player') score('special'); }),
    ];
    const stage = new ThreeStage(hostRef.current, props.player, props.opponent, bridge, () => setStageReady(true));
    // A failed optional model load must never leave the game trapped behind the overlay.
    const stageFallback = window.setTimeout(() => setStageReady(true), 8000);
    const hudTimer = window.setInterval(() => {
      const h = bridge.hud;
      setHud({ playerHealth: h.playerHealth, botHealth: h.botHealth, playerCharge: h.playerCharge, timer: h.timer, round: h.round, banner: h.banner });
    }, 80);

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 1280,
      height: 720,
      backgroundColor: 'rgba(0,0,0,0)',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1500 }, debug: false } },
      scene: [],
      banner: false,
      transparent: true,
    });

    game.scene.add('fight', new FightScene({ ...props, bridge, onExit: () => setConfirmExit(true), onComplete: (result) => { if (result.won && !result.tied) score('win'); props.onComplete(result); }, onVisualFrame: (frame) => stage.update(frame) }), true);
    const readyTimer = window.setTimeout(() => setGameReady(true), 900);
    return () => {
      fightAudio.stopMusic();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      stage.destroy();
      game.destroy(true);
      bridge.dispose();
      scoreOff.forEach((off) => off());
      room.dispose();
      window.clearInterval(hudTimer);
      bridgeRef.current = null;
      window.clearTimeout(helpTimer);
      window.clearTimeout(readyTimer);
      window.clearTimeout(stageFallback);
    };
  }, [props.player, props.opponent, props.difficulty]);

  return <div ref={hostRef} className="fight-host">
    {(!stageReady || !gameReady) && <div className="arena-loading"><strong>LOADING ARENA</strong><span>Preparing fighters and world...</span></div>}
    {confirmExit && <div className="exit-modal"><div><strong>EXIT MATCH?</strong><span>Your current round will be lost.</span><div><button type="button" onClick={() => setConfirmExit(false)}>CONTINUE</button><button type="button" onClick={props.onExit}>EXIT</button></div></div></div>}
    <div className={`fight-hud ${stageReady ? '' : 'is-hidden'}`} aria-live="polite">
      <div className="fight-health player"><span>{props.player.toUpperCase()}</span><div><i style={{ width: `${hud.playerHealth * 100}%` }} /></div></div>
      <div className="fight-round">{hud.banner || `ROUND ${hud.round}`}<strong>{hud.timer}</strong></div>
      <div className="fight-health bot"><span>{props.opponent.toUpperCase()}</span><div><i style={{ width: `${hud.botHealth * 100}%` }} /></div></div>
    </div>
    {showHelp && stageReady && <div className="arena-help"><strong>HOW TO FIGHT</strong><span>A / D MOVE · W JUMP · SHIFT DASH · J LIGHT · K HEAVY · L BLOCK · U ABILITY · I ULTIMATE</span></div>}
    <div className="mobile-controls" aria-label="Touch controls">
      <div className="mobile-stick"><TouchButton keyName="a" label="◀" /><TouchButton keyName="d" label="▶" /></div>
      <div className="mobile-action-zone">
        <div className="mobile-actions">
          <TouchButton keyName="w" label="JUMP" className="action-up" />
          <TouchButton keyName="j" label="HIT" className="action-left" />
          <TouchButton keyName="k" label="HEAVY" className="action-right" />
          <TouchButton keyName="l" label="BLOCK" className="action-down" />
        </div>
        {hud.playerCharge >= 0.5 && <TouchButton keyName="u" label="SPECIAL" className="special-popup" />}
      </div>
    </div>
  </div>;
}

function TouchButton({ keyName, label, className = '' }: { keyName: string; label: string; className?: string }) {
  const send = (type: 'keydown' | 'keyup') => {
    window.dispatchEvent(new CustomEvent('veilstrike-touch', { detail: { key: keyName === 'a' || keyName === 'd' ? 'moveDir' : ({ w: 'jump', shift: 'dash', j: 'light', k: 'heavy', l: 'block', u: 'special', i: 'ultimate' } as Record<string, string>)[keyName], down: type === 'keydown', direction: keyName === 'a' ? -1 : 1 } }));
    const event = new KeyboardEvent(type, { key: keyName, code: keyName.toUpperCase(), bubbles: true });
    window.dispatchEvent(event);
    document.dispatchEvent(event);
  };
  return <button type="button" className={`touch-control ${className}`} onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); send('keydown'); }} onPointerUp={() => send('keyup')} onPointerCancel={() => send('keyup')}>{label}</button>;
}
