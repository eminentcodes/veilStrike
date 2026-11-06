export declare const ARENA_WIDTH = 1280;
export declare const ARENA_HEIGHT = 720;
/** Y (pixels, top-origin) of the ground plane the fighters stand on. */
export declare const FLOOR_Y = 600;
/** Play-space walls, in world pixels. Fighters are clamped to this band. */
export declare const ARENA_LEFT = 150;
export declare const ARENA_RIGHT: number;
/** Center line the camera frames around. */
export declare const ARENA_CENTER_X: number;
/** Pixels per Three.js world unit. Tuned so the ~1000px play band ≈ 11 units wide. */
export declare const PIXELS_PER_UNIT = 92;
/** World-pixel X → stage X (0 at arena center, +X to the right). */
export declare function stageX(worldX: number): number;
/** World-pixel Y (top-origin, floor at FLOOR_Y) → stage height (0 at floor, +Y up). */
export declare function stageY(worldY: number): number;
/** A world-pixel length → stage units (for hitbox/VFX sizing). */
export declare function stageLen(px: number): number;
