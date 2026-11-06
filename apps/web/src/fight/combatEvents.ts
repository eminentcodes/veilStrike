// Centralized combat event bus (spec §26). The Phaser combat sim is the single source
// of truth: it emits typed events, and the Three.js view, the audio layer, and the React
// HUD all subscribe. This keeps presentation modular — none of those systems poll the sim.
//
// One `CombatBridge` is created per fight in FightGame and handed to every side, so nothing
// leaks across React StrictMode remounts (a fresh bridge each mount, disposed on cleanup).

import type { FighterId } from './types';

/** Which fighter an event refers to. */
export type Side = 'player' | 'bot';

export type ReactionStrength = 'light' | 'medium' | 'heavy' | 'critical';

export interface HitPayload {
  attacker: Side;
  defender: Side;
  /** Contact point in Phaser world pixels (converted to 3D by the view). */
  x: number;
  y: number;
  facing: 1 | -1;
  strength: ReactionStrength;
  heavy: boolean;
  /** Metal-on-metal (weapon/armor) vs body contact — drives spark vs dust. */
  metallic: boolean;
  damage: number;
  comboCount: number;
}

export interface SimplePoint {
  side: Side;
  x: number;
  y: number;
  facing: 1 | -1;
}

export interface CombatEventMap {
  entryStart: { player: FighterId; bot: FighterId };
  entryDone: void;
  roundStart: { round: number };
  roundEnd: { winner: Side };
  attackStarted: { side: Side; moveId: string; heavy: boolean };
  attackWhiffed: { side: Side; moveId: string };
  hit: HitPayload;
  blocked: HitPayload;
  perfectParry: SimplePoint & { by: Side };
  guardBroken: SimplePoint;
  counter: { side: Side };
  dodge: SimplePoint;
  knockdown: SimplePoint;
  special: { side: Side; ability: string };
  ultimate: { side: Side };
  finisher: { side: Side; x: number; y: number };
  /** Freeze animation for `ms` (hit-stop), driven from a single place. */
  hitstop: { ms: number };
  /** Camera emphasis: shake magnitude 0..1 and optional zoom punch. */
  cameraImpact: { magnitude: number; zoom: number };
  victory: { side: Side };
  defeat: { side: Side };
}

type Handler<K extends keyof CombatEventMap> = (payload: CombatEventMap[K]) => void;

export class CombatEvents {
  private handlers: { [K in keyof CombatEventMap]?: Set<Handler<K>> } = {};

  on<K extends keyof CombatEventMap>(event: K, handler: Handler<K>): () => void {
    const store = this.handlers as Record<string, Set<Handler<K>> | undefined>;
    const set = (store[event] ??= new Set<Handler<K>>());
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends keyof CombatEventMap>(event: K, payload: CombatEventMap[K]): void {
    const set = this.handlers[event] as Set<Handler<K>> | undefined;
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  clear(): void {
    this.handlers = {};
  }
}

/** Continuously-updated HUD state. Mutated in place each sim frame; the React HUD reads it
 *  on its own rAF cadence so 60fps sim ticks don't force 60fps React re-renders (spec §30). */
export interface HudSnapshot {
  phase: 'entry' | 'fight' | 'roundEnd' | 'matchEnd';
  round: number;
  timer: number;
  playerHealth: number; // 0..1
  botHealth: number; // 0..1
  playerStamina: number; // 0..1
  botStamina: number; // 0..1
  playerCharge: number; // 0..1 ability meter
  botCharge: number; // 0..1
  playerRounds: number;
  botRounds: number;
  comboSide: Side | null;
  comboCount: number;
  banner: string; // ROUND 1 / FIGHT / K.O. / etc. ('' = hidden)
  canSkipIntro: boolean;
}

export function createHudSnapshot(): HudSnapshot {
  return {
    phase: 'entry',
    round: 1,
    timer: 90,
    playerHealth: 1,
    botHealth: 1,
    playerStamina: 1,
    botStamina: 1,
    playerCharge: 0,
    botCharge: 0,
    playerRounds: 0,
    botRounds: 0,
    comboSide: null,
    comboCount: 0,
    banner: '',
    canSkipIntro: false,
  };
}

/** The shared object handed to the sim (writes), the view (subscribes), and the HUD (reads). */
export class CombatBridge {
  readonly events = new CombatEvents();
  readonly hud: HudSnapshot = createHudSnapshot();

  dispose(): void {
    this.events.clear();
  }
}
