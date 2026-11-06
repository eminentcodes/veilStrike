import { useEffect, useRef, useState, type ReactNode } from 'react';

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
export const DESIGN_WIDTH = 705;
export const DESIGN_HEIGHT = 447;

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

export function Stage({
  children,
  width: designWidth = DESIGN_WIDTH,
  height: designHeight = DESIGN_HEIGHT,
  backdrop,
}: StageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const fit = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setScale(Math.min(width / designWidth, height / designHeight));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [designWidth, designHeight]);

  return (
    <div
      ref={hostRef}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: 'var(--color-gr-page)',
      }}
    >
      {backdrop && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            /* Overscan past the edges so the blur has pixels to sample and does
             * not fade to transparent at the border. */
            inset: -40,
            backgroundImage: `url(${backdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(22px) saturate(0.9)',
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          width: designWidth,
          height: designHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          /* Lifts the panel off the blurred backdrop so its edge reads clearly. */
          boxShadow: '0 0 0 1px var(--color-gr-panel-border), 0 10px 40px rgb(0 0 0 / 0.45)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
