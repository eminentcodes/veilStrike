import type { Difficulty } from '../fight/types.js';

export type ArenaId = 'sanctum' | 'forge' | 'grove' | 'citadel' | 'rift';
export type ChampionId = 'karen' | 'taren' | 'nomet' | 'veyra' | 'mawren' | 'neris' | 'vesper' | 'rhoven' | 'seyra' | 'varkesh';
export type SkillStyle = 'blade' | 'oath' | 'grave' | 'chain' | 'rune' | 'snare' | 'poison' | 'scatter' | 'divided' | 'furnace';
export type CharacterTier = 'Basic' | 'Premium' | 'Legendary';
export type CharacterLevel = 1 | 2 | 3;
export type DuelMode = 'practice' | 'pvp';
export type MoveId = 'light' | 'heavy' | 'special' | 'ultimate';

export interface ArenaDefinition {
  id: ArenaId; name: string; subtitle: string; color: string;
  sky: number; fog: number; stone: number; accent: number; light: number;
}
export const ARENAS: Record<ArenaId, ArenaDefinition> = {
  sanctum: { id: 'sanctum', name: 'ASHEN SANCTUM', subtitle: 'Beneath a shattered moon', color: '#a3c5d1', sky: 0x101c2a, fog: 0x152234, stone: 0x384451, accent: 0x8ad5ec, light: 0xd0e5ff },
  forge: { id: 'forge', name: 'CINDER FORGE', subtitle: 'Where the mountain burns', color: '#ef9a59', sky: 0x231311, fog: 0x2b1714, stone: 0x38312f, accent: 0xff693b, light: 0xffc49b },
  grove: { id: 'grove', name: 'DROWNED GROVE', subtitle: 'The forest remembers', color: '#99c9ac', sky: 0x101c19, fog: 0x172b23, stone: 0x39483e, accent: 0x75e7b5, light: 0xc9e3d2 },
  citadel: { id: 'citadel', name: 'FROSTFALL CITADEL', subtitle: 'Steel beneath the northern lights', color: '#a5dbea', sky: 0x10212c, fog: 0x263747, stone: 0x5a6c7a, accent: 0x90d9ed, light: 0xd5edff },
  rift: { id: 'rift', name: 'THE HOLLOW RIFT', subtitle: 'At the edge of existence', color: '#b9a2da', sky: 0x141120, fog: 0x20182b, stone: 0x41354d, accent: 0xa68ad8, light: 0xd9c5ee },
};

export interface Move {
  id: MoveId; startup: number; active: number; recovery: number; damage: number;
  range: number; arc: number; stamina: number; lunge: number; knockback: number;
  clip: string[]; breakGuard?: boolean; strikes?: number;
}
export interface Champion {
  id: ChampionId; name: string; title: string; weapon: string; description: string;
  specialty: string; accent: string; model: string; health: number; speed: number;
  stamina: number; regen: number; size: number; armor: number; specialName: string;
  ultimateName: string; cost: number; skill: SkillStyle; moves: Record<MoveId, Move>;
  tier: CharacterTier; species: 'Human' | 'Undead' | 'Spirit' | 'Demon';
  identity: string; outfit: string; signature: string; weakness: string; height: number;
  portrait: string; cooldown: number; upgrades: [string, string];
}
import { CHAMPIONS } from './roster.js';
export { CHAMPIONS } from './roster.js';

export const FIGHTER_IDS = Object.keys(CHAMPIONS) as ChampionId[];
export const STARTER_FIGHTER_IDS = ['karen', 'taren', 'nomet'] as const;
export type StarterFighterId = (typeof STARTER_FIGHTER_IDS)[number];
export const PLAYABLE_FIGHTER_IDS: ChampionId[] = ['karen', 'taren', 'nomet', 'veyra', 'mawren'];
export function playableFighter(value: unknown): value is ChampionId { return typeof value === 'string' && PLAYABLE_FIGHTER_IDS.includes(value as ChampionId); }
export const ARENA_IDS = Object.keys(ARENAS) as ArenaId[];
export interface DuelConfig { player: ChampionId; opponent: ChampionId; arena: ArenaId; difficulty: Difficulty; mode: DuelMode; playerLevel?: CharacterLevel; opponentLevel?: CharacterLevel; }
export function validFighter(value: unknown): value is ChampionId { return typeof value === 'string' && FIGHTER_IDS.includes(value as ChampionId); }
export function validArena(value: unknown): value is ArenaId { return typeof value === 'string' && ARENA_IDS.includes(value as ArenaId); }



export function levelHealth(id: ChampionId, level: CharacterLevel = 1): number { return Math.round(CHAMPIONS[id].health * (1 + (level - 1) * .05)); }
export function levelDamage(level: CharacterLevel = 1): number { return 1 + (level - 1) * .03; }
