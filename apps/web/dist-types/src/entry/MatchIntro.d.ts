import type { DuelConfig } from '@/duel/catalog';
import './match-intro.css';
export declare function MatchIntro({ config, playerName, ready, loadProgress, onComplete, onExit }: {
    config: DuelConfig;
    playerName: string;
    ready: boolean;
    loadProgress?: number;
    onComplete: () => void;
    onExit: () => void;
}): import("react").JSX.Element;
