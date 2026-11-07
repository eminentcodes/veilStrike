import type { ChampionId, CharacterLevel, StarterFighterId } from './catalog';
import type { MatchResult } from '../fight/types';
export interface PlayerProfile {
    version: 1;
    name: string;
    id: string;
    embers: number;
    matches: number;
    wins: number;
    selectedFighter: ChampionId;
    onboarding: {
        setup: boolean;
        lobby: boolean;
        combat: boolean;
    };
    levels: Partial<Record<ChampionId, CharacterLevel>>;
    claimed: string[];
    daily: {
        day: string;
        matches: number;
        firstWin: boolean;
        threeMatches: boolean;
    };
    spin?: {
        day: string;
        reward: number;
    };
}
export declare const ONBOARDING_EMBERS = 1500;
export declare const UPGRADE_COST: {
    1: number;
    2: number;
    3: number;
};
export declare const SPIN_REWARDS: number[];
export declare const spinDay: () => string;
export declare function spinEmbers(profile: PlayerProfile, random?: number): {
    profile: PlayerProfile;
    index: number;
    reward: number;
};
export declare function newProfile(): PlayerProfile;
export declare function loadProfile(): PlayerProfile;
export declare function saveProfile(profile: PlayerProfile): void;
export declare function playerNameError(name: string): string;
export declare function completeSetup(profile: PlayerProfile, name: string, fighter: StarterFighterId): PlayerProfile;
export declare function completeOnboarding(profile: PlayerProfile, part: 'lobby' | 'combat'): PlayerProfile;
export declare function unlockCharacter(profile: PlayerProfile, id: ChampionId): PlayerProfile;
export declare function upgradeCharacter(profile: PlayerProfile, id: ChampionId): PlayerProfile;
export declare function rewardMatch(profile: PlayerProfile, token: string, result: MatchResult): {
    profile: PlayerProfile;
    reward: number;
};
