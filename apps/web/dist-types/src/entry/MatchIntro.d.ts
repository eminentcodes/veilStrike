import type { DuelConfig } from '@/duel/catalog';
import './match-intro.css';
export declare function MatchIntro({ config, playerName, ready, onComplete, onExit }: {
    config: DuelConfig;
    playerName: string;
    ready: boolean;
    onComplete: () => void;
    onExit: () => void;
}): import("react").JSX.Element;
