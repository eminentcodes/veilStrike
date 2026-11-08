import { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, DeviceMobile } from '@phosphor-icons/react';
import './mobile-orientation.css';

type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };
const touchDevice = () => navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;

// Mounted with home, so the first touch can enter landscape before setup or lobby.
export function MobileOrientation({ location, hidden = false }: { location: 'home' | 'game'; hidden?: boolean }) {
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);
  const [mobile, setMobile] = useState(touchDevice);
  const request = useRef<() => void>(() => {});
  const supportsLock = typeof (screen.orientation as LockableOrientation | undefined)?.lock === 'function';

  useEffect(() => {
    const orientation = screen.orientation as LockableOrientation | undefined;
    const portraitQuery = window.matchMedia('(orientation: portrait)'), coarseQuery = window.matchMedia('(pointer: coarse)');
    let disposed = false, pending = false, attempted = false, ownsLock = false, ownsFullscreen = false;
    const update = () => { setPortrait(portraitQuery.matches); setMobile(touchDevice()); };
    const rotate = (interactive: boolean) => {
      if (disposed || pending || !touchDevice() || document.hidden || !orientation?.lock) return;
      pending = true;
      // Fullscreen must be requested synchronously inside the user gesture.
      const fullscreen = interactive && !document.fullscreenElement && document.fullscreenEnabled
        ? document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => { ownsFullscreen = true; })
        : Promise.resolve();
      void fullscreen.then(async () => {
        if (disposed) return;
        await orientation.lock!('landscape');
        if (disposed) orientation.unlock(); else ownsLock = true;
      }).catch(() => {
        // Unsupported/denied locks leave the responsive page and rotate hint usable.
      }).finally(() => {
        pending = false;
        if (disposed && ownsFullscreen && document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {});
      });
    };
    const activate = (event: Event) => {
      if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
      if (attempted || pending || !touchDevice() || !orientation?.lock) return;
      attempted = true; rotate(true);
    };
    const fullscreenChanged = () => {
      if (!document.fullscreenElement && ownsFullscreen) {
        ownsFullscreen = false;
        if (ownsLock) { orientation?.unlock(); ownsLock = false; }
      }
      update();
    };
    request.current = () => { attempted = true; rotate(true); };
    portraitQuery.addEventListener('change', update); coarseQuery.addEventListener('change', update);
    document.addEventListener('pointerdown', activate, true);
    window.addEventListener('keydown', activate, true);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    // Installed PWAs may allow this immediately; normal tabs wait for first touch.
    rotate(false);
    return () => {
      disposed = true; request.current = () => {};
      portraitQuery.removeEventListener('change', update); coarseQuery.removeEventListener('change', update);
      document.removeEventListener('pointerdown', activate, true);
      window.removeEventListener('keydown', activate, true);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      if (ownsLock) orientation?.unlock();
      if (ownsFullscreen && document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  if (!mobile || !portrait || hidden) return null;
  return <aside className={'mobile-orientation-hint is-' + location} aria-label="Landscape play">
    <DeviceMobile size={18}/><span>Rotate for a wider arena</span>
    {supportsLock && <button type="button" onClick={() => request.current()} aria-label="Switch to landscape"><ArrowsClockwise size={16}/></button>}
  </aside>;
}
