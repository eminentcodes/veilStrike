import type { DuelConfig } from './catalog';
import type { RoomConnection } from './network';
import type { MatchResult } from '../fight/types';
interface Props {
    config: DuelConfig;
    room?: RoomConnection | null;
    onExit: () => void;
    onComplete: (result: MatchResult) => void;
}
export declare function DuelGame({ config, room, onExit, onComplete }: Props): import("react").JSX.Element;
export {};
