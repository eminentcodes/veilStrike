import { type AiRoleId, type CharacterId, type ContractId } from '@goldrush/shared';
export interface ExpeditionSetup {
    /** Who the player is taking in — the one thing they choose. */
    character: CharacterId;
    /** Derived from the character; the AI fills the other three roles. */
    role: AiRoleId;
    /** The primary objective, rolled for the run (GDD 4.7). */
    contract: ContractId;
}
export declare function getExpeditionSetup(): ExpeditionSetup;
/** The setup modal's only output. Everything else about the run is derived. */
export declare function setExpeditionCharacter(character: CharacterId): void;
/** A stable mine number for the run, shown on crew-ready as "Nexus Mine #083". */
export declare function mineNumber(): number;
/** Called when a new expedition is configured, so each run gets its own mine. */
export declare function rollMine(): void;
/**
 * The crew for the configured expedition: the player first, then AI miners
 * filling the remaining slots (GDD 5.3, 4.9). Roles are assigned so the crew
 * always covers all four of GDD 5.4 rather than doubling up.
 */
export interface CrewSlot {
    character: CharacterId;
    label: string;
    role: AiRoleId;
    miningPower: number;
    isPlayer: boolean;
}
export declare function crewFor(setup: ExpeditionSetup): CrewSlot[];
/** Total mining power of the crew — the number a Crystal Core is measured against. */
export declare function crewPower(setup: ExpeditionSetup): number;
export declare function contractLabel(setup: ExpeditionSetup): string;
