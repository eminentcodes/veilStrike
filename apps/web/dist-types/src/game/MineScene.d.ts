import Phaser from 'phaser';
export declare class MineScene extends Phaser.Scene {
    private p;
    private grid;
    private floorTiles;
    private player;
    private pickaxe;
    private playerLight;
    private wallGroup;
    private cart;
    private crew;
    private crystals;
    private hazards;
    private hazardMarks;
    private hazardSeq;
    private rockfallAt;
    private enemies;
    private attackReadyAt;
    private entranceAt;
    private gate;
    private gateBody;
    private gateTile;
    private gateAt;
    private vaultOpen;
    private vaultMouth;
    private vaultChamber;
    private vaultRow;
    private cursors;
    private keys;
    private dashUntil;
    private dashReadyAt;
    private facing;
    private bobPhase;
    private lastStep;
    private miningNode;
    private swingTween?;
    private setup;
    private contract;
    private playerPower;
    private traits;
    private vitality;
    private vitalityMax;
    private downed;
    private playerReviveMs;
    private stunnedUntil;
    private immuneUntil;
    /** Set each frame by the mite clouds the player is standing in. */
    private smothered;
    /** Points this run: bounties for kills, plus the score of everything banked. */
    private points;
    /** Deposit runs made by anyone, for the escort-the-cart contract. */
    private cartDeposits;
    private carried;
    private contractDone;
    /** How far the player has walked, which is all step one of the tutorial needs. */
    private walked;
    private tutorialStep;
    private pings;
    private pingSeq;
    private eventUntil;
    private activeEvent;
    private eventsFired;
    private yieldMultiplier;
    private hudAt;
    private state;
    constructor();
    create(): void;
    private tickClock;
    /**
     * Read a cell. Anything outside the map counts as solid rock, which is both
     * true of the world and what every neighbour scan below wants at the edges —
     * so none of them need their own bounds check.
     */
    private at;
    private set;
    /** Cellular automata: random fill, then smooth until caverns emerge. */
    private generateCave;
    /**
     * Carve the deposit vault: a one-tile corridor east out of the clearing into a
     * small chamber, with the cart at the far end.
     *
     * The user's ask was that banking ore be the hard part and that the crew has to
     * go down together. A single-file neck does both at once — nobody can slip past
     * anyone in it, hazards placed inside it cannot be walked around, and the gate
     * at its mouth answers to a *count* of miners rather than to one. Everything
     * either side of the neck is wide open, so the pressure is all in the run.
     */
    private carveVault;
    /**
     * Carve the way in, on the west wall, and a short tunnel joining it to the
     * cave.
     *
     * The run used to start in the middle of the cavern, which gave the mine no
     * shape: every direction looked the same and nothing was "deeper" than
     * anything else. Entering from the edge fixes that for free — the vault is on
     * the far wall, so distance from the door *is* the difficulty curve, and the
     * seams worth taking are the ones you have to walk past guards to reach.
     */
    private carveEntrance;
    /** Flood fill from the clearing; every floor tile it can't reach becomes rock. */
    private keepLargestRegion;
    /** Bake the whole cave into one texture — thousands of tile sprites would not. */
    private paintCave;
    private hasFloorNeighbour;
    /** Bodies only on the rock the player can actually walk into. */
    private buildColliders;
    /**
     * Breadth-first search across the floor grid. The cave is only 62x46, so an
     * exact search is cheaper than any heuristic would be to tune — and it is what
     * stops the crew from walking into walls and looking stupid.
     */
    private pathTo;
    /** Crystals, lanterns, props and the cart, placed against the generated cave. */
    private dressCave;
    /**
     * The cave mouth: daylight at your back, and a couple of lamps so the way out
     * stays findable once you are deep. Purely scenery — nothing here blocks.
     */
    private buildEntrance;
    /**
     * The gate at the corridor mouth, plus the lamps that make it read as the way
     * in.
     *
     * It starts *open* — the way to the cart is never barred, which was the whole
     * of the user's correction. It drops once miners are inside and the fight
     * starts, and lifts again when the vault is cleared (see `updateVault`).
     */
    private buildGate;
    /** Place one seam, wired for mining. Also used by the Crystal Bloom event. */
    private addSeam;
    private countWallNeighbours;
    private spawnPlayer;
    /**
     * The crew the player configured. Each takes one of the four GDD 5.4 roles,
     * which is what drives their behaviour in `thinkCrew`.
     */
    private spawnCrew;
    private randomFloorPoint;
    /**
     * Seed the mine with everything that can stop a miner working.
     *
     * Placement is weighted, not uniform: the clearing where the crew spawns stays
     * clean so the first thirty seconds are teachable, and the deposit corridor
     * gets the heaviest concentration because that is the run the user wanted to be
     * dangerous. Everything in between is scattered.
     */
    private spawnHazards;
    private addHazard;
    /**
     * One pass over every hazard: move it, then see who it caught.
     *
     * Kept as a single loop rather than a system per kind — they all reduce to
     * "drift somewhere, then check a radius", and four parallel loops over the same
     * array would only cost more and drift out of step.
     */
    private updateHazards;
    private updateSnare;
    private springSnare;
    /**
     * Mite clouds drift on their own and smother whoever stands in them: no damage
     * spike, just a steady bleed and no mining while inside. The counter is to
     * step out, so they must never chase.
     */
    private updateMites;
    /** Telegraph a boulder over a working miner, then drop it. */
    private dropRock;
    private updateRockfall;
    /** Nearest miner in range, player included. `mate: null` means the player. */
    private nearestMiner;
    /** Put a hazard on the mini map, once. */
    private revealHazard;
    /**
     * Seed the mine with things that fight back.
     *
     * Two populations with different jobs. Bats roam and are the teaching enemy —
     * cheap, fast, two hits — so the player learns the swing on something that
     * cannot really punish a miss. Guards are posted, one per high-value seam, and
     * are the reason the payoff seams cost something: the ore is visible from
     * across the cave, and there is a man standing on it.
     */
    private spawnEnemies;
    private addEnemy;
    /** How high above an enemy its health bar floats. */
    private barOffset;
    private updateEnemies;
    private stepEnemy;
    private idleEnemy;
    private showSlash;
    /**
     * Swing the pick. Bound to F, J and left-click, and deliberately not to E —
     * E is "work", and a player leaning on E next to a seam should never find
     * themselves in a fight they did not ask for.
     */
    private swingPick;
    /**
     * Land a hit. One path for the player and the crew, so a Warden takes the same
     * seven hits however they are delivered.
     */
    private damageEnemy;
    /** The enemy in front of the player, if any. One rule, used by hit and prompt. */
    private enemyInReach;
    private killEnemy;
    /** Whether a seam still has a live guard standing on it. */
    private guardOf;
    /** Bounties and banked ore both feed the same running total. */
    private addPoints;
    /**
     * Damage the player. `HAZARDS[kind].damage` is a share of *maximum* vitality,
     * so a strong miner loses more absolute vitality per hit but the same fraction
     * of their working life — which keeps every character equally survivable while
     * leaving the raw numbers different.
     */
    private hurtPlayer;
    private hurtMate;
    /**
     * Enemy damage. Kept as its own path rather than folded into `hurtPlayer`
     * because enemies are not hazards: their numbers live in `ENEMIES`, and only
     * two of the three kinds have any hazard counterpart at all.
     */
    private hurtPlayerBy;
    private hurtMateBy;
    /** Put a crewmate on the floor. Shared by the hazard and enemy damage paths. */
    private downMate;
    private downPlayer;
    private reviveMiner;
    private revivePlayer;
    /**
     * The revive loop, both directions: the player picking a mate up by holding E,
     * and the crew coming for the player when they go down. Also the vault's slow
     * heal, which is what makes the chamber worth the walk beyond banking ore.
     */
    private updateVitality;
    private inVault;
    /** Inside the neck: past the gate, short of the chamber. */
    private inCorridor;
    /**
     * The gate. It lifts only when enough miners are standing at it, holds while
     * anyone is still inside, and drops when the last one leaves — so a deposit run
     * is something the crew does together, which is what the user asked for.
     */
    private updateVault;
    private setGate;
    /** The layer that makes the cavern feel inhabited rather than rendered. */
    private startAmbience;
    /** GDD 4.8 / 9.6 — the MVP ships Earthquake and Crystal Bloom. */
    private startWorldEvent;
    private updateWorldEvent;
    private bindInput;
    update(_time: number, delta: number): void;
    private updatePlayer;
    /**
     * Role-driven crew (GDD 5.4). Each mate re-decides on a slow tick, then walks
     * a real path to whatever the decision produced; between decisions they just
     * follow waypoints, so the cost is a BFS every couple of seconds each.
     */
    private updateCrew;
    private thinkCrew;
    /**
     * The nearest miner on the floor, if this mate is the closest one standing.
     * Only one mate goes — the rest keep working, so a single snare does not stall
     * the whole crew.
     */
    private downedMiner;
    /**
     * Point a mate at an enemy. Kept separate from `assign` because a fight is not
     * a work assignment: the seam they were on stays theirs, so they go back to it
     * once the thing in front of them is down.
     */
    private fightEnemy;
    /**
     * One frame of a mate's fight. Returns true when it handled the mate's turn, so
     * `updateCrew` knows to skip mining and pathing for them this frame.
     *
     * Crew swings land at CREW_ATTACK_RATE, the same assist rate their mining runs
     * at (GDD 4.9): the crew helps you win the fight, but the killing blow is
     * usually yours.
     */
    private stepCrewFight;
    /**
     * The nearest live enemy to a point. Guards count only once someone is close
     * enough to have provoked them, which is what keeps the crew from marching
     * across the cave to a Warden nobody asked them to fight.
     */
    private nearestEnemy;
    /** "Explores unknown areas, reveals ore veins, places location pings." */
    private thinkScout;
    /** "Prioritizes large crystal deposits, assists with cooperative mining." */
    private thinkHeavyMiner;
    /** "Collects and transports resources, deposits into the expedition cart." */
    private thinkCarrier;
    /** "Assists nearby teammates, responds to help requests." */
    private thinkSupport;
    private mineNearest;
    private assign;
    private goTo;
    private followPath;
    /** A crewmate mining. They are slower than the player, per GDD 4.9. */
    private workSeamAsCrew;
    /** A Scout calling a vein — GDD 5.4 "places location pings". */
    private revealSeam;
    /** Hold E next to a seam to work it. */
    private updateMining;
    /** Combined mining power at a seam — the player plus every mate in range. */
    private powerAt;
    /** What the player actually swings with, after what the mine has taken. */
    private effectivePlayerPower;
    private crewAt;
    private nearestCrystal;
    private nearestNodeTo;
    private nearestOfKind;
    private crystalsLeft;
    private startSwing;
    private cancelMining;
    /** A successful strike by the player: ore goes into the pack, not the bank. */
    private collect;
    /** Spend one strike on a seam and retire it when it is worked out. */
    private breakStrike;
    private backpackTotal;
    /** GDD 4.6 — the cart is where ore becomes score. */
    private depositPlayer;
    private depositCrew;
    private bank;
    /** GDD 4.7 / 4.12 — the contract is the run's win condition. */
    private checkObjective;
    private updateQuickChat;
    private advanceTutorial;
    /** A short burst of chips, used for footfalls, dashes and pick strikes. */
    private puff;
    private withinRange;
    private withinPoint;
    private setContext;
    /** GDD 4.12 / 4.13 — extraction succeeds, or the clock beats you. */
    private endExpedition;
    private pushHud;
    /** What the player is doing, in the crew panel's own vocabulary. */
    private playerActivity;
}
