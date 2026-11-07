import type { Dispatch, SetStateAction } from 'react';
import type { PlayerProfile } from '@/duel/progression';
import '../duel/duel.css';
import '../duel/lobby.css';
export interface GameLobbyProps {
    profile: PlayerProfile;
    setProfile: Dispatch<SetStateAction<PlayerProfile>>;
    active: boolean;
    onReady: (ready: boolean) => void;
    onError?: (message: string) => void;
    backdrop?: boolean;
    scenePaused?: boolean;
}
export declare function GameLobby({ profile, setProfile, active, onReady, onError, backdrop, scenePaused }: GameLobbyProps): import("react").JSX.Element;
