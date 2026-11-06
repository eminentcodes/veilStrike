import type { ReactNode } from 'react';

/*
 * Button chrome rebuilt from `docs/ui/01-landing.png`.
 *
 * Vertical colour scan down x=255 gave the exact ramp for each button:
 *
 *   PRIMARY   y245 outline · y246-248 highlight · y249-289 face · y290-293 bevel · y294 outline
 *   SECONDARY y303 outline · y304-306 rim       · y307-347 body · y348-350 bevel · y351 outline
 *
 * Measured widths: x243..467 = 225px. Measured heights: 50px / 49px — the 1px
 * difference is generation jitter in the mockup, so the stack is normalised to
 * 50px with a 58px pitch (8px gap), matching the primary button exactly.
 */

export const BUTTON_WIDTH = 225;
export const BUTTON_HEIGHT = 50;
export const BUTTON_PITCH = 58;
const BUTTON_RADIUS = 10;

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  /** Top edge in design-space px, measured from the panel's top edge. */
  top: number;
  disabled?: boolean;
}

const baseStyle = {
  position: 'absolute',
  left: '50%',
  marginLeft: -BUTTON_WIDTH / 2,
  width: BUTTON_WIDTH,
  height: BUTTON_HEIGHT,
  borderRadius: BUTTON_RADIUS,
  display: 'grid',
  placeItems: 'center',
  transition: 'transform 90ms ease-out, filter 90ms ease-out',
} as const;

export function PrimaryButton({ children, onClick, top, disabled }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="gr-btn"
      style={{
        ...baseStyle,
        top,
        border: '1px solid var(--color-gr-primary-outline)',
        background: [
          'linear-gradient(',
          '  var(--color-gr-primary-highlight) 0px,',
          '  var(--color-gr-primary-highlight) 3px,',
          '  var(--color-gr-primary-face-top) 3px,',
          '  var(--color-gr-primary-face-mid) 22px,',
          '  var(--color-gr-primary-face-bottom) 43px,',
          '  var(--color-gr-primary-bevel) 43px,',
          '  var(--color-gr-primary-bevel-dark) 48px',
          ')',
        ].join(''),
      }}
    >
      <span
        style={{
          /* Glyphs sit on the face, not the bevel — nudge up by half the lip. */
          marginTop: -5,
          fontSize: 17,
          fontWeight: 900,
          letterSpacing: '0.03em',
          color: 'var(--color-gr-primary-label)',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </button>
  );
}

export function SecondaryButton({ children, onClick, top, disabled }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="gr-btn"
      style={{
        ...baseStyle,
        top,
        border: '1px solid var(--color-gr-secondary-outline)',
        background: [
          'linear-gradient(',
          '  var(--color-gr-secondary-rim) 0px,',
          '  var(--color-gr-secondary-rim) 3px,',
          '  var(--color-gr-secondary-body-top) 3px,',
          '  var(--color-gr-secondary-body-bottom) 43px,',
          '  var(--color-gr-secondary-bevel) 43px,',
          '  var(--color-gr-secondary-bevel) 48px',
          ')',
        ].join(''),
      }}
    >
      <span
        style={{
          marginTop: -5,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: '0.03em',
          color: 'var(--color-gr-secondary-label)',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </button>
  );
}
