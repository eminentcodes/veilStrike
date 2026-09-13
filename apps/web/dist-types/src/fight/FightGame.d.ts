import type { Difficulty, FighterId, MatchResult } from './types';
interface FightGameProps {
    player: FighterId;
    opponent: FighterId;
    difficulty: Difficulty;
    onExit: () => void;
    onComplete: (result: MatchResult) => void;
}
export declare function FightGame(props: FightGameProps): import("react").JSX.Element;
export {};
