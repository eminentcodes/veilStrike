import type { Difficulty } from '../fight/types.js';
export type ArenaId = 'sanctum' | 'forge' | 'grove' | 'citadel' | 'rift';
export type ChampionId = 'karen' | 'taren' | 'nomet' | 'veyra' | 'mawren' | 'neris' | 'vesper' | 'rhoven' | 'seyra' | 'varkesh';
export type SkillStyle = 'blade' | 'oath' | 'grave' | 'chain' | 'rune' | 'snare' | 'poison' | 'scatter' | 'divided' | 'furnace';
export type CharacterTier = 'Basic' | 'Premium' | 'Legendary';
export type CharacterLevel = 1 | 2 | 3;
export type DuelMode = 'practice' | 'pvp';
export type MoveId = 'light' | 'heavy' | 'special' | 'ultimate';
export interface ArenaDefinition {
    id: ArenaId;
    name: string;
    subtitle: string;
    color: string;
    sky: number;
    fog: number;
    stone: number;
    accent: number;
    light: number;
}
export declare const ARENAS: Record<ArenaId, ArenaDefinition>;
export interface Move {
    id: MoveId;
    startup: number;
    active: number;
    recovery: number;
    damage: number;
    range: number;
    arc: number;
    stamina: number;
    lunge: number;
    knockback: number;
    clip: string[];
    breakGuard?: boolean;
    strikes?: number;
}
export interface Champion {
    id: ChampionId;
    name: string;
    title: string;
    weapon: string;
    description: string;
    specialty: string;
    accent: string;
    model: string;
    health: number;
    speed: number;
    stamina: number;
    regen: number;
    size: number;
    armor: number;
    specialName: string;
    ultimateName: string;
    cost: number;
    skill: SkillStyle;
    moves: Record<MoveId, Move>;
    tier: CharacterTier;
    species: 'Human' | 'Undead' | 'Spirit' | 'Demon';
    identity: string;
    outfit: string;
    signature: string;
    weakness: string;
    height: number;
    portrait: string;
    cooldown: number;
    upgrades: [string, string];
}
export { CHAMPIONS } from './roster.js';
export declare const FIGHTER_IDS: ChampionId[];
export declare const STARTER_FIGHTER_IDS: readonly ["karen", "taren", "nomet"];
export type StarterFighterId = (typeof STARTER_FIGHTER_IDS)[number];
export declare const PLAYABLE_FIGHTER_IDS: ChampionId[];
export declare function playableFighter(value: unknown): value is ChampionId;
export declare const ARENA_IDS: ArenaId[];
export interface DuelConfig {
    player: ChampionId;
    opponent: ChampionId;
    arena: ArenaId;
    difficulty: Difficulty;
    mode: DuelMode;
    playerLevel?: CharacterLevel;
    opponentLevel?: CharacterLevel;
}
export declare function validFighter(value: unknown): value is ChampionId;
export declare function validArena(value: unknown): value is ArenaId;
export declare function levelHealth(id: ChampionId, level?: CharacterLevel): number;
export declare function levelDamage(level?: CharacterLevel): number;
