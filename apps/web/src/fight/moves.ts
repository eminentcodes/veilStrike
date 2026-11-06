// Data-driven move definitions (spec §9–13). Each move declares readable timing
// (anticipation / strike / recovery), a facing-relative hitbox rectangle that is only live
// during the active window, forward momentum, a hit reaction, stamina cost, and which moves
// it can cancel into and when. The fight loop is a pure interpreter of this data, so combat
// depth and per-character identity grow by editing tables — not the loop.

export type ArchetypeId = 'assassin' | 'duelist' | 'monk' | 'berserker' | 'shadow' | 'spear';

export type ReactionType =
  | 'light' // quick recoil, short stun
  | 'medium' // firm stagger
  | 'heavy' // big stagger + knockback
  | 'launch' // pops the victim up for juggles
  | 'trip' // low hit → knockdown
  | 'crumple' // guard break / special → slow collapse
  | 'knockdown'; // hard down

export type MoveKind = 'light' | 'heavy' | 'launcher' | 'sweep' | 'dash' | 'special' | 'ultimate';

/** Facing-relative hitbox. Center = (fighter.x + facing * x, fighter.y + y); the sim builds
 *  an AABB of `w`×`h` around it and tests against the defender's hurtbox. */
export interface Hitbox {
  x: number; // forward offset from the fighter's body center, px
  y: number; // vertical offset (negative = up), px
  w: number;
  h: number;
}

export interface MoveDef {
  id: string;
  kind: MoveKind;
  /** ms — readable wind-up before the hitbox is live. */
  startup: number;
  /** ms — hitbox is live. */
  active: number;
  /** ms — commitment after the strike. */
  recovery: number;
  damage: number; // base; scaled by fighter power in the sim
  hitbox: Hitbox;
  /** forward velocity (px/s) applied at strike start — attack momentum (spec §10). */
  momentum: number;
  knockbackX: number;
  knockbackY: number;
  reaction: ReactionType;
  stamina: number;
  /** true = ignores standing block (lows, throws, guard-breakers). */
  unblockableByGuard?: boolean;
  guardBreak?: boolean;
  /** ms hit-stop on clean contact (spec §18). */
  hitstop: number;
  metallic: boolean; // weapon/armor contact → sparks vs dust
  /** Move ids (or 'dodge' | 'block') this can cancel into. */
  cancelInto: string[];
  /** [fromMs, toMs] relative to move start where a buffered input is consumed (spec §11–12). */
  cancelWindow: [number, number];
  /** Clip-intent keywords the view scores against the rig's real clip names (spec §4, P4). */
  clip: string[];
  /** Vertical launch flag for juggle bookkeeping. */
  launches?: boolean;
}

const CHAIN = ['light2', 'light3', 'heavy', 'dodge', 'special'];

interface ArchetypeTuning {
  reach: number; // base forward reach (px) for mid attacks
  atk: number; // startup/recovery multiplier — <1 snappier, >1 more committed
  dmg: number; // base light damage
  momentum: number;
  knockback: number;
  lightClip: string[];
  heavyClip: string[];
}

const ARCHETYPES: Record<ArchetypeId, ArchetypeTuning> = {
  //            reach  atk    dmg  mom  kb    lightClip                              heavyClip
  assassin: { reach: 96, atk: 0.82, dmg: 6, momentum: 130, knockback: 0.85, lightClip: ['dualwield_melee_attack_slice', 'dualwield', '1h_melee_attack_slice', 'slice'], heavyClip: ['dualwield_melee_attack_chop', '1h_melee_attack_chop', 'chop'] },
  duelist: { reach: 132, atk: 1.05, dmg: 8, momentum: 110, knockback: 1.05, lightClip: ['1h_melee_attack_slice_horizontal', '1h_melee_attack_slice', 'slice'], heavyClip: ['2h_melee_attack_chop', '1h_melee_attack_chop', 'chop'] },
  monk: { reach: 92, atk: 0.86, dmg: 6, momentum: 125, knockback: 0.9, lightClip: ['unarmed_melee_attack_punch_a', 'unarmed_melee_attack_punch', 'punch'], heavyClip: ['unarmed_melee_attack_kick', 'kick'] },
  berserker: { reach: 128, atk: 1.22, dmg: 10, momentum: 95, knockback: 1.35, lightClip: ['2h_melee_attack_slice', '1h_melee_attack_slice', 'slice'], heavyClip: ['2h_melee_attack_chop', '2h_melee_attack_spin', 'chop'] },
  shadow: { reach: 116, atk: 0.9, dmg: 7, momentum: 120, knockback: 0.95, lightClip: ['1h_melee_attack_slice_diagonal', '1h_melee_attack_slice', 'slice'], heavyClip: ['1h_melee_attack_chop', 'chop'] },
  spear: { reach: 168, atk: 1.12, dmg: 8, momentum: 90, knockback: 1.1, lightClip: ['1h_melee_attack_stab', '2h_melee_attack_stab', 'stab'], heavyClip: ['2h_melee_attack_stab', 'stab'] },
};

function buildMoveset(t: ArchetypeTuning): Record<string, MoveDef> {
  // Global snappiness pass: startup and recovery come in ~12% faster so lifting and
  // swinging a weapon never feels heavy. Per-archetype identity (t.atk) is preserved,
  // and active (contact) frames stay literal so hit-confirm timing is unchanged.
  const s = (ms: number) => Math.round(ms * t.atk * 0.88);
  const midY = -10;
  const reach = t.reach;

  const light1: MoveDef = {
    id: 'light1', kind: 'light', startup: s(90), active: 60, recovery: s(120),
    damage: t.dmg, hitbox: { x: reach * 0.6, y: midY, w: reach * 0.7, h: 68 },
    momentum: t.momentum, knockbackX: 150 * t.knockback, knockbackY: -40, reaction: 'light',
    stamina: 6, hitstop: 46, metallic: true, cancelInto: CHAIN, cancelWindow: [s(90) + 20, s(90) + 60 + s(120) * 0.6],
    clip: t.lightClip,
  };
  const light2: MoveDef = {
    ...light1, id: 'light2', startup: s(80), damage: t.dmg + 1,
    hitbox: { x: reach * 0.62, y: midY - 6, w: reach * 0.72, h: 70 },
    knockbackX: 165 * t.knockback, cancelWindow: [s(80) + 20, s(80) + 60 + s(120) * 0.6],
    clip: [t.lightClip[0] ?? 'slice', ...t.lightClip],
  };
  const light3: MoveDef = {
    id: 'light3', kind: 'light', startup: s(100), active: 70, recovery: s(180),
    damage: t.dmg + 4, hitbox: { x: reach * 0.66, y: midY, w: reach * 0.8, h: 74 },
    momentum: t.momentum * 1.2, knockbackX: 260 * t.knockback, knockbackY: -90, reaction: 'heavy',
    stamina: 10, hitstop: 70, metallic: true, cancelInto: ['dodge'], cancelWindow: [s(100) + 40, s(100) + 70 + s(180) * 0.4],
    clip: t.heavyClip,
  };
  const heavy: MoveDef = {
    id: 'heavy', kind: 'heavy', startup: s(175), active: 90, recovery: s(250),
    damage: t.dmg + 8, hitbox: { x: reach * 0.7, y: midY, w: reach * 0.9, h: 82 },
    momentum: t.momentum * 1.35, knockbackX: 320 * t.knockback, knockbackY: -130, reaction: 'heavy',
    stamina: 16, guardBreak: true, hitstop: 92, metallic: true,
    cancelInto: ['dodge'], cancelWindow: [s(175) + 60, s(175) + 90 + s(250) * 0.3],
    clip: t.heavyClip,
  };
  const launcher: MoveDef = {
    id: 'launcher', kind: 'launcher', startup: s(140), active: 80, recovery: s(260),
    damage: t.dmg + 5, hitbox: { x: reach * 0.5, y: -30, w: reach * 0.62, h: 120 },
    momentum: t.momentum * 0.6, knockbackX: 120, knockbackY: -430, reaction: 'launch', launches: true,
    stamina: 14, hitstop: 74, metallic: true, cancelInto: ['dodge', 'special'], cancelWindow: [s(140) + 40, s(140) + 80 + s(260) * 0.4],
    clip: ['2h_melee_attack_spin', 'unarmed_melee_attack_kick', 'slice_diagonal', ...t.heavyClip],
  };
  const sweep: MoveDef = {
    id: 'sweep', kind: 'sweep', startup: s(120), active: 70, recovery: s(210),
    damage: t.dmg + 2, hitbox: { x: reach * 0.58, y: 55, w: reach * 0.8, h: 46 },
    momentum: t.momentum * 0.8, knockbackX: 190 * t.knockback, knockbackY: 30, reaction: 'trip',
    stamina: 12, unblockableByGuard: true, hitstop: 66, metallic: false,
    cancelInto: ['dodge'], cancelWindow: [s(120) + 40, s(120) + 70 + s(210) * 0.4],
    clip: ['1h_melee_attack_slice_horizontal', 'sweep', 'low', ...t.lightClip],
  };
  const dashAttack: MoveDef = {
    id: 'dashAttack', kind: 'dash', startup: s(95), active: 90, recovery: s(200),
    damage: t.dmg + 3, hitbox: { x: reach * 0.72, y: midY, w: reach * 0.85, h: 76 },
    momentum: t.momentum * 2.2, knockbackX: 240 * t.knockback, knockbackY: -70, reaction: 'medium',
    stamina: 12, hitstop: 64, metallic: true, cancelInto: ['dodge'], cancelWindow: [s(95) + 30, s(95) + 90 + s(200) * 0.4],
    clip: ['1h_melee_attack_stab', 'dualwield_melee_attack_stab', 'stab', ...t.lightClip],
  };
  const aerial: MoveDef = {
    id: 'aerial', kind: 'light', startup: 70, active: 150, recovery: s(160),
    damage: t.dmg + 3, hitbox: { x: reach * 0.58, y: 10, w: reach * 0.86, h: 108 },
    momentum: t.momentum * 0.72, knockbackX: 220 * t.knockback, knockbackY: -80, reaction: 'medium',
    stamina: 8, hitstop: 62, metallic: true, cancelInto: [], cancelWindow: [0, 0],
    clip: ['jump', '2h_melee_attack_chop', 'slice_diagonal', ...t.heavyClip],
  };

  return { light1, light2, light3, heavy, launcher, sweep, dashAttack, aerial };
}

/** Signature specials + ultimates, hand-authored per fighter (spec §13). Merged into the
 *  archetype set. These are what make each fighter feel unmistakably different. */
const SIGNATURES: Record<string, MoveDef> = {
  // KAEL — Assassin: Shadow Step strike. Very fast, big forward reposition; empowered after a dodge.
  kael_special: {
    id: 'special', kind: 'special', startup: 70, active: 90, recovery: 260,
    damage: 18, hitbox: { x: 70, y: -10, w: 120, h: 84 }, momentum: 520, knockbackX: 300, knockbackY: -110,
    reaction: 'heavy', stamina: 26, hitstop: 96, metallic: true, cancelInto: ['light1'], cancelWindow: [160, 320],
    clip: ['dualwield_melee_attack_stab', 'dualwield_melee_attack_slice', 'dash', 'stab'],
  },
  // AKIO — Ronin: Precision Draw. Long committed wind-up, then an extremely fast decisive slash.
  ronin_special: {
    id: 'special', kind: 'special', startup: 300, active: 70, recovery: 360,
    damage: 30, hitbox: { x: 120, y: -10, w: 190, h: 90 }, momentum: 260, knockbackX: 360, knockbackY: -150,
    reaction: 'crumple', stamina: 30, guardBreak: true, hitstop: 130, metallic: true, cancelInto: [], cancelWindow: [0, 0],
    clip: ['2h_melee_attack_slice', '1h_melee_attack_slice_horizontal', 'slice'],
  },
  // SAI — Monk: Flow Counter. Short, fast, low-commit — the punish tool after a parry/dodge.
  monk_special: {
    id: 'special', kind: 'special', startup: 60, active: 220, recovery: 200,
    damage: 20, hitbox: { x: 60, y: -10, w: 110, h: 96 }, momentum: 180, knockbackX: 210, knockbackY: -60,
    reaction: 'medium', stamina: 22, hitstop: 60, metallic: false, cancelInto: ['light1'], cancelWindow: [120, 420],
    clip: ['unarmed_melee_attack_punch_b', 'unarmed_melee_attack_punch', 'punch'],
  },
  // BRAKK — Berserker: Rage Break. Heavy forward guard-breaker that interrupts light attacks.
  brakk_special: {
    id: 'special', kind: 'special', startup: 230, active: 110, recovery: 380,
    damage: 26, hitbox: { x: 80, y: -10, w: 150, h: 110 }, momentum: 320, knockbackX: 420, knockbackY: -120,
    reaction: 'crumple', stamina: 34, guardBreak: true, unblockableByGuard: true, hitstop: 128, metallic: true,
    cancelInto: [], cancelWindow: [0, 0], clip: ['2h_melee_attack_chop', '2h_melee_attack_spinning', 'chop'],
  },
  // NYX — Shadow: Vanish Feint. Fast backstep-then-strike that punishes whiffs.
  shade_special: {
    id: 'special', kind: 'special', startup: 90, active: 80, recovery: 240,
    damage: 19, hitbox: { x: 90, y: -10, w: 130, h: 84 }, momentum: 360, knockbackX: 280, knockbackY: -90,
    reaction: 'heavy', stamina: 24, hitstop: 90, metallic: true, cancelInto: ['light1'], cancelWindow: [150, 300],
    clip: ['1h_melee_attack_slice_diagonal', '1h_melee_attack_slice', 'slice'],
  },
  // VALEN — Spear: Keep Away. Long thrust that creates distance (pushes valen back on hit).
  valen_special: {
    id: 'special', kind: 'special', startup: 150, active: 90, recovery: 300,
    damage: 22, hitbox: { x: 150, y: -10, w: 230, h: 60 }, momentum: -120, knockbackX: 460, knockbackY: -40,
    reaction: 'heavy', stamina: 26, hitstop: 92, metallic: true, cancelInto: ['dodge'], cancelWindow: [220, 420],
    clip: ['2h_melee_attack_stab', '1h_melee_attack_stab', 'stab'],
  },
};

// Ultimate — a shared, dramatic finisher template scaled per fighter power in the sim.
function ultimateFor(clip: string[]): MoveDef {
  return {
    id: 'ultimate', kind: 'ultimate', startup: 220, active: 140, recovery: 420,
    damage: 44, hitbox: { x: 90, y: -10, w: 200, h: 130 }, momentum: 300, knockbackX: 520, knockbackY: -260,
    reaction: 'knockdown', stamina: 0, guardBreak: true, unblockableByGuard: true, hitstop: 180, metallic: true,
    cancelInto: [], cancelWindow: [0, 0], clip,
  };
}

export type Moveset = Record<string, MoveDef>;

const MOVESET_BY_ARCHETYPE: Record<ArchetypeId, Moveset> = {
  assassin: buildMoveset(ARCHETYPES.assassin),
  duelist: buildMoveset(ARCHETYPES.duelist),
  monk: buildMoveset(ARCHETYPES.monk),
  berserker: buildMoveset(ARCHETYPES.berserker),
  shadow: buildMoveset(ARCHETYPES.shadow),
  spear: buildMoveset(ARCHETYPES.spear),
};

/** Assemble the full per-fighter move table: archetype base + signature + ultimate. */
export function movesetFor(fighterId: string, archetype: ArchetypeId): Moveset {
  const base = MOVESET_BY_ARCHETYPE[archetype];
  const special = SIGNATURES[`${fighterId}_special`];
  const ult = ultimateFor([...(special?.clip ?? []), '2h_melee_attack_spinning', 'spin']);
  return {
    ...base,
    ...(special ? { special } : {}),
    ultimate: ult,
  };
}

export function moveDuration(move: MoveDef): number {
  return move.startup + move.active + move.recovery;
}
