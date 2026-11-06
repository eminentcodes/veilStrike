export type FighterId = 'kael' | 'ronin' | 'monk' | 'brakk' | 'shade' | 'valen';
export type Difficulty = 'initiate' | 'warrior' | 'master';

export interface FighterDefinition {
  id: FighterId;
  name: string;
  title: string;
  archetype: string;
  weapon: string;
  outfit: string;
  description: string;
  strengths: string[];
  weakness: string;
  health: number;
  speed: number;
  power: number;
  reach: number;
  accent: string;
}

export const FIGHTER_DEFINITIONS: Record<FighterId, FighterDefinition> = {
  kael: { id: 'kael', name: 'KAEL', title: 'THE VEILED ASSASSIN', archetype: 'Assassin', weapon: 'Twin short blades', outfit: 'Hood, face wrap, light leather, split scarf', description: 'A silent close-range hunter who wins through speed and relentless pressure.', strengths: ['Fast movement', 'Quick recovery', 'Close-range combos'], weakness: 'Low guard durability', health: 138, speed: 265, power: 0.92, reach: 112, accent: '#b52f28' },
  ronin: { id: 'ronin', name: 'AKIO', title: 'THE FALLEN RONIN', archetype: 'Duelist', weapon: 'Long katana', outfit: 'Layered lamellar armor, damaged pauldron, worn cloak', description: 'A disciplined swordsman with precise spacing and punishing counters.', strengths: ['Weapon reach', 'Counter attacks', 'Balanced defense'], weakness: 'Slower startup', health: 100, speed: 228, power: 1.04, reach: 166, accent: '#9c7a4d' },
  monk: { id: 'monk', name: 'SAI', title: 'THE IRON MONK', archetype: 'Martial artist', weapon: 'Weighted staff', outfit: 'Wrapped hands, sleeveless robe, prayer cords', description: 'A mobile hand-to-hand fighter who turns movement into impact.', strengths: ['Air attacks', 'Evasion', 'Combo control'], weakness: 'Short weapon range', health: 96, speed: 255, power: 0.96, reach: 106, accent: '#c49a55' },
  brakk: { id: 'brakk', name: 'BRAKK', title: 'THE PIT BERSERKER', archetype: 'Berserker', weapon: 'War hammer', outfit: 'Exposed arms, heavy plates, trophy wraps, iron belt', description: 'A brutal champion whose committed blows break guards and launch opponents.', strengths: ['High damage', 'Knockback', 'Guard pressure'], weakness: 'Slow movement', health: 116, speed: 190, power: 1.22, reach: 150, accent: '#d0c9bd' },
  shade: { id: 'shade', name: 'NYX', title: 'THE SHADOW WARRIOR', archetype: 'Trickster', weapon: 'Curved blade', outfit: 'Layered black cloth, half mask, long sash, hidden sheath', description: 'An unreadable fighter who uses deceptive timing and retreating cuts.', strengths: ['Feints', 'Backstep attacks', 'Low profile'], weakness: 'Lower raw damage', health: 94, speed: 246, power: 0.9, reach: 132, accent: '#7765c9' },
  valen: { id: 'valen', name: 'VALEN', title: 'THE SPEAR WARDEN', archetype: 'Sentinel', weapon: 'Battle spear', outfit: 'Medium scale armor, shoulder guard, braced boots', description: 'A battlefield sentinel who owns the center line with disciplined spacing.', strengths: ['Longest reach', 'Stable guard', 'Wall control'], weakness: 'Weakest close pressure', health: 108, speed: 205, power: 1.08, reach: 184, accent: '#5ea895' },
};

export interface MatchResult {
  won: boolean;
  tied?: boolean;
  playerRounds: number;
  botRounds: number;
  /** How the final blow landed, for the result screen's flavor line ('' if timed out). */
  finish?: 'ko' | 'ultimate' | 'timeout' | 'perfect';
}

/** Player input controls, listed here so the HUD legend and key-binding stay in one place. */
export const CONTROLS = {
  left: 'A',
  right: 'D',
  jump: 'W',
  crouch: 'S',
  light: 'J',
  heavy: 'K',
  block: 'L',
  dash: 'SHIFT',
  dodge: 'S', // tap crouch-dir during neutral → dodge; held = crouch
  special: 'U',
  ultimate: 'I',
  escape: 'ESC',
} as const;
