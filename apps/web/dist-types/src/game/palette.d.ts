export declare function token(name: string): number;
/** Every colour the mine renders with, resolved once on scene create. */
export declare function minePalette(): {
    void: number;
    wall: number;
    wallLit: number;
    floor: number;
    floorLit: number;
    rock: number;
    rockLight: number;
    timber: number;
    cool: number;
    crystalCore: number;
    crystalMid: number;
    crystalDeep: number;
    crystalShadow: number;
    flame: number;
    glow: number;
    gold: number;
    green: number;
    purple: number;
    brown: number;
    cream: number;
    charcoal: number;
};
export type MinePalette = ReturnType<typeof minePalette>;
