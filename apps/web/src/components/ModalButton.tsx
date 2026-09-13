/*
 * Buttons used inside dialogs — the stacked controls in
 * `docs/ui/06-screens-modals-states.png` panel 7 (PAUSE MENU).
 *
 * Two variants appear in the art: green for ordinary actions ("Resume",
 * "Settings", "Return to Base Camp") and red for destructive ones ("Leave
 * Expedition"). Both share one geometry — full-width in the card, ~18px tall in
 * a 162px card, 6px gaps, 4px radius, a 1px dark keyline, and a lighter top rim.
 *
 * Ramps are the pixel scans recorded in tokens.css; nothing is invented here.
 */

import type { ReactNode } from 'react';

type Variant = 'green' | 'red';

const RAMPS: Record<Variant, { rim: string; top: string; mid: string; bottom: string; outline: string }> = {
  green: {
    rim: 'var(--color-gr-btn-green-rim)',
    top: 'var(--color-gr-btn-green-top)',
    mid: 'var(--color-gr-btn-green-mid)',
    bottom: 'var(--color-gr-btn-green-bottom)',
    outline: 'var(--color-gr-btn-green-outline)',
  },
  red: {
    rim: 'var(--color-gr-btn-red-rim)',
    top: 'var(--color-gr-btn-red-top)',
    mid: 'var(--color-gr-btn-red-mid)',
    bottom: 'var(--color-gr-btn-red-bottom)',
    outline: 'var(--color-gr-btn-red-outline)',
  },
};

export function ModalButton({
  variant = 'green',
  onClick,
  disabled,
  children,
}: {
  variant?: Variant;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const ramp = RAMPS[variant];

  return (
    <button
      type="button"
      className="gr-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        width: '100%',
        height: 30,
        borderRadius: 5,
        border: `1px solid ${ramp.outline}`,
        /* Top rim highlight, then the face ramp — as scanned down the button. */
        background: `linear-gradient(${ramp.rim} 0 2px, ${ramp.top} 2px, ${ramp.mid} 55%, ${ramp.bottom} 100%)`,
        color: 'var(--color-gr-btn-label)',
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: '0.01em',
        textShadow: '0 1px 0 rgb(0 0 0 / 0.35)',
      }}
    >
      {children}
    </button>
  );
}
