export type CombatState = 'entry' | 'idle' | 'combat_idle' | 'move' | 'dash' | 'dodge' | 'jump' | 'crouch' | 'attack' | 'block' | 'parry' | 'hit' | 'stagger' | 'guard_break' | 'knockdown' | 'wakeup' | 'special' | 'finisher' | 'victory' | 'defeat';
export interface StatePermissions {
    /** Player/AI intent can steer horizontal movement in this state. */
    canMove: boolean;
    /** Attacks / abilities can be initiated from this state (subject to cancel rules). */
    canAct: boolean;
    /** Incoming attacks pass through without connecting. */
    invulnerable: boolean;
    /** Counts as a hard-reeling state the fighter cannot self-interrupt. */
    reeling: boolean;
}
export declare const STATE_PERMS: Record<CombatState, StatePermissions>;
/** States a fighter can freely act from (before cancel-window rules refine it). */
export declare function isActionable(state: CombatState): boolean;
/** States where the fighter is reacting to a hit and cannot act. */
export declare function isReeling(state: CombatState): boolean;
/** Neutral states the fighter returns to when nothing else is happening. */
export declare function isNeutral(state: CombatState): boolean;
