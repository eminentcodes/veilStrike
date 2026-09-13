type MusicMode = 'menu' | 'fight';
export declare const audio: {
    readonly muted: boolean;
    setMuted(next: boolean): void;
    unlock(): Promise<void>;
    startMusic(mode?: MusicMode): void;
    stopMusic(): void;
    hover(): void;
    press(): void;
    chime(): void;
    alert(): void;
    mine(): void;
    collect(): void;
    deposit(): void;
};
export {};
