/*
 * Modal shell — the parchment-in-a-wooden-frame dialog from
 * `docs/ui/06-screens-modals-states.png`, panels 7 (PAUSE MENU) and 11
 * (DISCONNECT / RECONNECT).
 *
 * Structure read off panel 7, in mockup pixels:
 *
 *   frame outer      x30..192  y866..1008   (rounded ~9px, 6px wood band)
 *   parchment card   x36..186  y872..1002
 *   corner rivets    ~5px, inset ~6px from each parchment corner
 *   close chip       x173..188 y866..882    (top-right, overlapping the frame)
 *   title            centred, heavy, uppercase, ~13px in a 162px-wide card
 *   button stack     x48..168, 18px tall, 6px gaps
 *
 * Scaled here to the 705x447 design space the screens are authored in. No
 * colour appears that was not sampled into tokens.css from the art.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

const RIVET_INSET = 6;

/** The four corner rivets punched through the parchment in the art. */
function Rivets() {
  const corners = [
    { top: RIVET_INSET, left: RIVET_INSET },
    { top: RIVET_INSET, right: RIVET_INSET },
    { bottom: RIVET_INSET, left: RIVET_INSET },
    { bottom: RIVET_INSET, right: RIVET_INSET },
  ];

  return (
    <>
      {corners.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            ...pos,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--color-gr-frame-rivet)',
            opacity: 0.75,
          }}
        />
      ))}
    </>
  );
}

export function Modal({
  title,
  subtitle,
  width = 300,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  width?: number;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  /* Escape closes, and focus moves into the dialog so keyboard users are not
   * left behind on the page underneath. */
  useEffect(() => {
    cardRef.current?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        /* The art dims the scene behind its dialogs rather than blurring it. */
        background: 'rgb(0 0 0 / 0.55)',
        zIndex: 10,
      }}
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width,
          /* The stage is a fixed 705x447 design panel with overflow hidden, so a
           * dialog taller or wider than it is silently clipped at both edges.
           * Bounding it to the panel — and letting the parchment scroll inside
           * if a future dialog outgrows it — means that can never happen, at any
           * scale. */
          maxWidth: 'calc(100% - 24px)',
          maxHeight: 'calc(100% - 16px)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          padding: 6,
          borderRadius: 9,
          outline: 'none',
          background:
            'linear-gradient(var(--color-gr-frame-wood-light), var(--color-gr-frame-wood))',
          border: '1px solid var(--color-gr-frame-outline)',
          boxShadow: '0 6px 18px rgb(0 0 0 / 0.45)',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            borderRadius: 5,
            border: '1px solid var(--color-gr-frame-outline)',
            background:
              'linear-gradient(var(--color-gr-parchment), var(--color-gr-parchment-deep))',
            padding: '12px 14px 14px',
            textAlign: 'center',
          }}
        >
          <Rivets />

          <h2
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 900,
              letterSpacing: '0.01em',
              color: 'var(--color-gr-modal-title)',
            }}
          >
            {title}
          </h2>

          {subtitle && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-gr-modal-body)',
              }}
            >
              {subtitle}
            </p>
          )}

          {children}
        </div>

        {onClose && <CloseChip onClick={onClose} />}
      </div>
    </div>
  );
}

/* Top-right close chip, overlapping the frame exactly as in panel 7. */
function CloseChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="gr-btn"
      style={{
        position: 'absolute',
        top: -7,
        right: -5,
        width: 20,
        height: 20,
        borderRadius: 5,
        background:
          'linear-gradient(var(--color-gr-frame-wood), var(--color-gr-frame-rivet))',
        border: '1px solid var(--color-gr-frame-outline)',
        color: 'var(--color-gr-gold)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 5l14 14M19 5L5 19"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
