/*
 * Top chrome for the landing panel, rebuilt from `docs/ui/01-landing.png`.
 *
 * Measured in mockup pixels, then expressed relative to the panel origin
 * (16, 46):
 *
 *   status pill      x26..140  y57..83   ->  left 10,  top 11, 114 x 27
 *   settings button  x637..711 y57..84   ->  right 10, top 11,  74 x 27
 *
 * Both chips share one rim + fill treatment; only the fill differs by a hair
 * (#232116 vs #2E271A), which is sampling noise over the painted background
 * rather than a deliberate distinction — so both use the same token pair.
 */

const CHIP_HEIGHT = 27;
const CHIP_RADIUS = 9;

const chipStyle = {
  position: 'absolute',
  top: 11,
  height: CHIP_HEIGHT,
  borderRadius: CHIP_RADIUS,
  border: '1px solid var(--color-gr-chip-rim)',
  background: 'var(--color-gr-chip-body)',
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--color-gr-chip-label)',
  fontWeight: 800,
  whiteSpace: 'nowrap',
} as const;

export function PlayersOnlinePill({ count }: { count: number }) {
  return (
    <div style={{ ...chipStyle, left: 10, width: 114, gap: 6, paddingInline: 9 }}>
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: 'var(--color-gr-online-dot)',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 10.5, letterSpacing: '0.02em' }}>
        {count} PLAYERS ONLINE
      </span>
    </div>
  );
}

export function SettingsButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Settings"
      style={{ ...chipStyle, right: 10, width: 74, gap: 5, paddingInline: 8 }}
    >
      <GearIcon />
      <span style={{ fontSize: 11, fontWeight: 700 }}>Settings</span>
    </button>
  );
}

/*
 * Sound toggle. Not drawn in the mockup — the art has no audio control — so it
 * is built from the same chip treatment as the two that ARE drawn, and tucked
 * immediately left of Settings on the same 11px baseline. Square, because it is
 * icon-only.
 */
export function SoundButton({
  muted,
  onClick,
}: {
  muted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={muted}
      style={{
        ...chipStyle,
        right: 90,
        width: CHIP_HEIGHT,
        justifyContent: 'center',
      }}
    >
      {muted ? <SoundOffIcon /> : <SoundOnIcon />}
    </button>
  );
}

function SoundOnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 9v6h3.5L13 20V4L7.5 9H4Zm12.5 3a4 4 0 0 0-2-3.5v7a4 4 0 0 0 2-3.5Zm-2 -8v2.1a6 6 0 0 1 0 11.8V20a8 8 0 0 0 0-16Z" />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 9v6h3.5L13 20V4L7.5 9H4Zm17 .4L19.6 8l-2.1 2.1L15.4 8 14 9.4l2.1 2.1L14 13.6 15.4 15l2.1-2.1 2.1 2.1 1.4-1.4-2.1-2.1L21 9.4Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.9 2h-3.8l-.5 2.6a8 8 0 0 0-1.6.9L5.5 4.4 3.6 7.7l2 1.7a8 8 0 0 0 0 1.9l-2 1.7 1.9 3.3 2.5-1.1c.5.4 1 .7 1.6.9l.5 2.6h3.8l.5-2.6c.6-.2 1.1-.5 1.6-.9l2.5 1.1 1.9-3.3-2-1.7a8 8 0 0 0 0-1.9l2-1.7-1.9-3.3-2.5 1.1a8 8 0 0 0-1.6-.9L13.9 2Zm-1.9 6.7a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Z" />
    </svg>
  );
}
