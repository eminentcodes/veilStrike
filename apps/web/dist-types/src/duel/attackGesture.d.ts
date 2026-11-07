/** Pair presses before committing so a double tap produces one heavy, never a light plus heavy. */
export declare const DOUBLE_ATTACK_MS = 200;
export declare class AttackGesture {
    private pending;
    private queued;
    press(now: number): void;
    sample(now: number): 'light' | 'heavy' | null;
    reset(): void;
}
