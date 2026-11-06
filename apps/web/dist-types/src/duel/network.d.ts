import type { DuelConfig, ArenaId } from './catalog';
import type { ChampionId } from './catalog';
import type { DuelSnapshot, InputFrame, Slot } from './simulation';
export interface RoomInfo {
    code: string;
    status: 'waiting' | 'loading' | 'fighting';
    arena: ArenaId;
    players: [{
        fighter: ChampionId;
        name: string;
        ready: boolean;
    } | null, {
        fighter: ChampionId;
        name: string;
        ready: boolean;
    } | null];
}
export declare class RoomConnection {
    readonly socket: WebSocket;
    slot: Slot;
    info: RoomInfo | null;
    config: DuelConfig | null;
    snapshot: DuelSnapshot | null;
    error: string;
    private listeners;
    private disposed;
    private lastEvent;
    private queuedEvents;
    constructor();
    subscribe(listener: () => void): () => void;
    private notify;
    connect(): Promise<void>;
    create(fighter: ChampionId, arena: ArenaId, name: string): void;
    join(code: string, fighter: ChampionId, name: string): void;
    ready(): void;
    loaded(): void;
    input(input: InputFrame): void;
    drainEvents(): DuelSnapshot['events'];
    private send;
    dispose(): void;
}
