// Combat state machine: the finite set of states a fighter can be in, plus the
// per-state permissions that keep transitions legal (spec §25). The fight loop reads
// these guards instead of scattering `if (state === ...)` checks everywhere.

export type CombatState =
  | 'entry' // cinematic walk-in / stance draw before the round begins
  | 'idle'
  | 'combat_idle' // alert neutral once the round is live
  | 'move' // walk / retreat
  | 'dash'
  | 'dodge'
  | 'jump'
  | 'crouch'
  | 'attack' // covers combo strings; the active move + comboIndex carry the detail
  | 'block'
  | 'parry'
  | 'hit' // light/medium stagger
  | 'stagger' // heavier reeling, longer
  | 'guard_break'
  | 'knockdown'
  | 'wakeup' // getting up, brief invulnerability
  | 'special'
  | 'finisher'
  | 'victory'
  | 'defeat';

export interface StatePermissions {
  /** Player/AI intent can steer horizontal movement in this state. */
  canMove: boolean;
  /** Attacks / abilities can be initiated from this state (subject to cancel rules). */
  canAct: boolean;
  /** Incoming attacks pass through without connecting. */
  invulnerable: boolean;
  /** Counts as a hard-reeling state the fighter cannot self-interrupt. */
  reeling: boolean;
}

const P = (
  canMove: boolean,
  canAct: boolean,
  invulnerable = false,
  reeling = false,
): StatePermissions => ({ canMove, canAct, invulnerable, reeling });

export const STATE_PERMS: Record<CombatState, StatePermissions> = {
  entry: P(false, false),
  idle: P(true, true),
  combat_idle: P(true, true),
  move: P(true, true),
  dash: P(false, true), // dash-attack cancel allowed, steering locked to the burst
  dodge: P(false, false, true), // i-frames applied via a tighter window inside the dodge
  jump: P(true, true), // air control + aerials
  crouch: P(false, true),
  attack: P(false, true), // movement locked; canAct gates combo/cancel via cancel windows
  block: P(true, true), // can walk-block slowly; releasing exits
  parry: P(false, true), // brief; opens a counter
  hit: P(false, false, true),
  stagger: P(false, false, true),
  guard_break: P(false, false, true),
  knockdown: P(false, false, false, true),
  wakeup: P(false, false, true, true),
  special: P(false, false),
  finisher: P(false, false),
  victory: P(false, false),
  defeat: P(false, false, false, true),
};

/** States a fighter can freely act from (before cancel-window rules refine it). */
export function isActionable(state: CombatState): boolean {
  return STATE_PERMS[state].canAct;
}

/** States where the fighter is reacting to a hit and cannot act. */
export function isReeling(state: CombatState): boolean {
  return STATE_PERMS[state].reeling || state === 'hit' || state === 'stagger';
}

/** Neutral states the fighter returns to when nothing else is happening. */
export function isNeutral(state: CombatState): boolean {
  return state === 'idle' || state === 'combat_idle' || state === 'move' || state === 'block';
}
