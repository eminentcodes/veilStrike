import type { ChampionId, CharacterLevel } from './catalog';
import type { MatchResult } from '../fight/types';
export interface PlayerProfile {
    version: 1;
    name: string;
    id: string;
    embers: number;
    matches: number;
    wins: number;
    levels: Partial<Record<ChampionId, CharacterLevel>>;
    claimed: string[];
    daily: {
        day: string;
        matches: number;
        firstWin: boolean;
        threeMatches: boolean;
    };
}
export declare const UPGRADE_COST: {
    1: number;
    2: number;
    3: number;
};
export declare function newProfile(): PlayerProfile;
export declare function loadProfile(): PlayerProfile;
export declare function saveProfile(profile: PlayerProfile): void;
export declare function unlockCharacter(profile: PlayerProfile, id: ChampionId): PlayerProfile;
export declare function upgradeCharacter(profile: PlayerProfile, id: ChampionId): PlayerProfile;
export declare function rewardMatch(profile: PlayerProfile, token: string, result: MatchResult): {
    profile: PlayerProfile;
    reward: number;
};
