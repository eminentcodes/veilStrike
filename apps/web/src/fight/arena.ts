// Shared arena constants and the single source of truth for converting Phaser world pixels
// into Three.js stage units. Both the sim (FightScene) and the view (ThreeStage) import from
// here so the fight geometry can never drift between the two engines.

export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;

/** Y (pixels, top-origin) of the ground plane the fighters stand on. */
export const FLOOR_Y = 600;

/** Play-space walls, in world pixels. Fighters are clamped to this band. */
export const ARENA_LEFT = 150;
export const ARENA_RIGHT = ARENA_WIDTH - 150;

/** Center line the camera frames around. */
export const ARENA_CENTER_X = ARENA_WIDTH / 2;

/** Pixels per Three.js world unit. Tuned so the ~1000px play band ≈ 11 units wide. */
export const PIXELS_PER_UNIT = 92;

/** World-pixel X → stage X (0 at arena center, +X to the right). */
export function stageX(worldX: number): number {
  return (worldX - ARENA_CENTER_X) / PIXELS_PER_UNIT;
}

/** World-pixel Y (top-origin, floor at FLOOR_Y) → stage height (0 at floor, +Y up). */
export function stageY(worldY: number): number {
  return (FLOOR_Y - worldY) / PIXELS_PER_UNIT;
}

/** A world-pixel length → stage units (for hitbox/VFX sizing). */
export function stageLen(px: number): number {
  return px / PIXELS_PER_UNIT;
}
