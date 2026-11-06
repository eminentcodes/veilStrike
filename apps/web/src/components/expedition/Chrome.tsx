/*
 * Shared chrome for the expedition flow (matchmaking, crew ready).
 *
 * Both screens are the same painted camp in the reference art
 * (`docs/ui/04-matchmaking-crewready.png`) with cream cards laid over it. Here
 * that becomes a full-bleed scenic backdrop plus DOM panels, so the layout
 * reflows to any viewport instead of scaling as one fixed plate.
 *
 * Sizes use clamp() against vmin so a single set of components reads correctly
 * from a laptop to a 4K display without a second breakpoint set.
 */

import type { CSSProperties, ReactNode } from 'react';

/** Panel copy scales with the viewport; this is the base step. */
export const TEXT = 'clamp(11px, 1.15vmin, 15px)';
export const TEXT_SM = 'clamp(9.5px, 0.95vmin, 12.5px)';
export const TEXT_LG = 'clamp(14px, 1.7vmin, 21px)';

/**
 * The camp outside the mine. `cover` keeps it filling any aspect; the plate is
 * already scrimmed top and bottom so panels sit legibly on it.
 */
export function ExpeditionBackdrop({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: 'clamp(8px, 1.4vmin, 20px)',
        padding: 'clamp(10px, 2.2vmin, 30px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-display)',
        backgroundColor: 'var(--color-gr-mine-void)',
        backgroundImage: 'url(/art/expedition-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 42%',
      }}
    >
      {children}
    </div>
  );
}

/**
 * The wooden headline plate — "PREPARING EXPEDITION" / "CREW READY!" in the art.
 * Wood frame, cream face, heavy dark title, lighter subtitle.
 */
export function Banner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        justifySelf: 'center',
        maxWidth: 'min(760px, 94vw)',
        padding: 'clamp(4px, 0.6vmin, 8px)',
        borderRadius: 'clamp(8px, 1.1vmin, 14px)',
        background:
          'linear-gradient(var(--color-gr-frame-wood-light), var(--color-gr-banner-wood))',
        border: '1px solid var(--color-gr-frame-outline)',
        boxShadow: '0 6px 20px rgb(0 0 0 / 0.5)',
      }}
    >
      <div
        style={{
          borderRadius: 'clamp(5px, 0.7vmin, 9px)',
          border: '1px solid var(--color-gr-frame-outline)',
          background:
            'linear-gradient(var(--color-gr-banner), var(--color-gr-parchment-deep))',
          padding: 'clamp(6px, 1.1vmin, 14px) clamp(14px, 3vmin, 40px)',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(19px, 3.2vmin, 42px)',
            fontWeight: 900,
            letterSpacing: '0.01em',
            lineHeight: 1.1,
            color: 'var(--color-gr-modal-title)',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 'clamp(11px, 1.4vmin, 18px)',
            fontWeight: 700,
            color: 'var(--color-gr-modal-body)',
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

/** The cream card the roster rows and info tables sit in. */
export function CreamCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 'clamp(8px, 1.2vmin, 16px)',
        border: '2px solid var(--color-gr-card-rim)',
        background: 'var(--color-gr-card)',
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.45)',
        color: 'var(--color-gr-card-title)',
        padding: 'clamp(8px, 1.4vmin, 18px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The dark green progress panel at the foot of the Preparing Expedition plate. */
export function DarkPanel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 'clamp(8px, 1.2vmin, 16px)',
        border: '2px solid var(--color-gr-bar-rim)',
        background: 'var(--color-gr-bar-panel)',
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.45)',
        color: 'var(--color-gr-parchment)',
        padding: 'clamp(8px, 1.3vmin, 17px) clamp(10px, 1.8vmin, 24px)',
      }}
    >
      {children}
    </div>
  );
}

/** Progress track — brown groove, green fill, as scanned from the art. */
export function Track({ value }: { value: number }) {
  return (
    <div
      style={{
        height: 'clamp(10px, 1.5vmin, 20px)',
        borderRadius: 999,
        background: 'var(--color-gr-track-empty)',
        overflow: 'hidden',
        border: '1px solid var(--color-gr-bar-rim)',
      }}
    >
      <div
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          height: '100%',
          borderRadius: 999,
          background:
            'linear-gradient(var(--color-gr-btn-green-rim), var(--color-gr-track-fill))',
          transition: 'width 400ms linear',
        }}
      />
    </div>
  );
}

/*
 * Miner chip. The art gives each character a distinct hat colour, which is the
 * one thing that has to survive at chip size, so the portrait reduces to a
 * helmet in that colour on the card's inset tile.
 */
const HAT: Record<string, string> = {
  great: 'var(--color-gr-green)',
  nova: 'var(--color-gr-purple)',
  atlas: 'var(--color-gr-brown)',
  ember: 'var(--color-gr-gold)',
};

export function MinerPortrait({
  id,
  size = 'clamp(30px, 4vmin, 54px)',
  dim,
}: {
  id: string;
  size?: string;
  dim?: boolean;
}) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 'clamp(5px, 0.8vmin, 10px)',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-gr-card-tile)',
        border: '1px solid var(--color-gr-card-rim)',
        opacity: dim ? 0.45 : 1,
      }}
    >
      <svg width="62%" height="62%" viewBox="0 0 24 24" aria-hidden>
        <path d="M4 15a8 8 0 0 1 16 0v1H4v-1Z" fill={HAT[id] ?? 'var(--color-gr-charcoal)'} />
        <rect x="2" y="16" width="20" height="2.6" rx="1.3" fill={HAT[id] ?? 'var(--color-gr-charcoal)'} />
        <circle cx="12" cy="8.6" r="2.2" fill="var(--color-gr-gold)" />
      </svg>
    </div>
  );
}

/** Empty slot marker — the dashed ring drawn beside "Searching for miner...". */
export function EmptySlot({ size = 'clamp(30px, 4vmin, 54px)' }: { size?: string }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        border: '2px dashed var(--color-gr-card-rim)',
        opacity: 0.8,
      }}
    />
  );
}

/** The three animated dots trailing a row that is still searching. */
export function Ellipsis() {
  return (
    <span
      aria-hidden
      style={{ display: 'inline-flex', gap: 'clamp(3px, 0.4vmin, 5px)', alignItems: 'center' }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="gr-dot"
          style={{
            width: 'clamp(4px, 0.55vmin, 7px)',
            height: 'clamp(4px, 0.55vmin, 7px)',
            borderRadius: '50%',
            background: 'var(--color-gr-card-title)',
            animationDelay: `${i * 160}ms`,
          }}
        />
      ))}
    </span>
  );
}

/** The green tick beside a confirmed crew member. */
export function OkCheck() {
  return (
    <span
      aria-hidden
      style={{
        width: 'clamp(15px, 2vmin, 26px)',
        height: 'clamp(15px, 2vmin, 26px)',
        borderRadius: '50%',
        background: 'var(--color-gr-status-ok)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="62%" height="62%" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M4 13l5 5L20 6"
          stroke="var(--color-gr-banner)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
