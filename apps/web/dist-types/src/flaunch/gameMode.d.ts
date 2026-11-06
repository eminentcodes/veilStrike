export interface DuelConfig {
    maxPoints: number;
}
export interface DuelState {
    opensAt: number;
    closesAt: number;
    points: Record<string, number>;
    events: number;
}
export type DuelAction = {
    type: 'hit' | 'special' | 'win';
};
export interface VeilstrikeView {
    phase: 'open' | 'closed';
    points: Record<string, number>;
    events: number;
}
export declare const rules: import("@flayerlabs/gamemode-spec").GameModule<DuelConfig, DuelState, {
    type: "scored";
    player: string;
    points: number;
}, DuelAction, VeilstrikeView, VeilstrikeView>;
export declare function createVeilstrikeRoom(): import("@flayerlabs/gamemode-client").Room<VeilstrikeView, VeilstrikeView, DuelAction>;
