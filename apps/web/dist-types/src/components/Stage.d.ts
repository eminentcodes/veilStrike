import { type ReactNode } from 'react';
/**
 * The reference art `docs/ui/01-landing.png` places the game panel at
 * x16..720, y46..492 — a 705 x 447 box (aspect 1.5772). Every screen is
 * authored in that exact pixel space so measurements taken off the mockup can
 * be used verbatim, then uniformly scaled to whatever the viewport allows.
 *
 * Scaling is `contain`: the whole panel is always visible, never cropped. A
 * viewport that does not share the panel's aspect would otherwise show bars, so
 * the panel's own plate is repeated behind it — full-bleed, blurred, and
 * scaled to cover — which fills the screen edge to edge without introducing a
 * single colour that was not already in the art.
 */
export declare const DESIGN_WIDTH = 705;
export declare const DESIGN_HEIGHT = 447;
interface StageProps {
    children: ReactNode;
    /** Design-space size. Defaults to the landing panel's 705 x 447. Screens
     * whose reference art has a different aspect pass their own plate size so
     * measured coordinates stay usable verbatim. */
    width?: number;
    height?: number;
    /** Plate repeated behind the panel to fill the letterbox. */
    backdrop?: string;
}
export declare function Stage({ children, width: designWidth, height: designHeight, backdrop, }: StageProps): import("react").JSX.Element;
export {};
