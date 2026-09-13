// The continuous per-frame bridge from the Phaser sim (FightScene) to the Three.js view
// (ThreeStage). Discrete moments — hits, blocks, parries, camera impacts, hit-stop — travel
// on the CombatEvents bus instead; this frame carries the smoothly-varying state the view
// needs to pose and animate every tick. Kept as a plain data contract (spec: widen the
// VisualFrame channel, don't re-architect it) so neither side imports the other.

import type { FighterId } from './types';
import type { CombatState } from './combatState';
import type { ReactionType } from './moves';

export type MovePhase = 'startup' | 'active' | 'recovery';

export interface FighterVisual {
  id: FighterId;
  /** Body-center position in Phaser world pixels. */
  x: number;
  y: number;
  facing: 1 | -1;
  state: CombatState;
  /** Active move id, or null when not attacking. */
  moveId: string | null;
  movePhase: MovePhase | null;
  /** 0..1 progress across the whole move (startup→recovery), for clip time-sync. */
  moveProgress: number;
  /** Kind of the active move ('light'|'heavy'|'special'|… ) for clip/trail selection. */
  moveKind: string | null;
  vx: number;
  vy: number;
  grounded: boolean;
  blocking: boolean;
  /** True only during the dodge i-frame window (drives the view's ghost/blur). */
  dodgingIFrames: boolean;
  comboCount: number;
  healthFrac: number;
  staminaFrac: number;
  chargeFrac: number;
  /** Set for one frame's worth of reaction onset; the view latches its own decay. */
  reaction: ReactionType | null;
}

export type MatchPhase = 'entry' | 'fight' | 'roundEnd' | 'matchEnd';

/** A live in-flight projectile (thrown knife, etc.). The sim owns the authoritative motion and
 *  collision; the view just mirrors this list each frame, spawning/retiring meshes by `id`. */
export interface ProjectileVisual {
  id: number;
  /** Which mesh the view should render (e.g. 'knife'). */
  kind: string;
  /** Body-center position in Phaser world pixels. */
  x: number;
  y: number;
  facing: 1 | -1;
  /** Owner fighter, so the view can tint the projectile to its accent. */
  ownerId: FighterId;
  /** 0..1 through its lifetime, for fade/spin. */
  life: number;
}

export interface VisualFrame {
  time: number;
  /** ms since previous frame (already clamped by the sim). */
  dt: number;
  player: FighterVisual;
  bot: FighterVisual;
  /** In-flight projectiles this frame (empty when none). */
  projectiles: ProjectileVisual[];
  /** ms of hit-stop remaining; the view freezes its mixers while > 0. */
  hitstopRemaining: number;
  phase: MatchPhase;
  /** 0..1 through the entry cinematic (1 once the round is live). */
  entryProgress: number;
}
