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
export declare const FIGHTER_DEFINITIONS: Record<FighterId, FighterDefinition>;
export interface MatchResult {
    won: boolean;
    tied?: boolean;
    playerRounds: number;
    botRounds: number;
    /** How the final blow landed, for the result screen's flavor line ('' if timed out). */
    finish?: 'ko' | 'ultimate' | 'timeout' | 'perfect';
}
/** Player input controls, listed here so the HUD legend and key-binding stay in one place. */
export declare const CONTROLS: {
    readonly left: "A";
    readonly right: "D";
    readonly jump: "W";
    readonly crouch: "S";
    readonly light: "J";
    readonly heavy: "K";
    readonly block: "L";
    readonly dash: "SHIFT";
    readonly dodge: "S";
    readonly special: "U";
    readonly ultimate: "I";
    readonly escape: "ESC";
};
