/*
 * Wires the audio system into React.
 *
 * Two jobs:
 *
 * 1. Unlock. Browsers keep an AudioContext suspended until a real user gesture,
 *    so we try on mount (works for a returning player whose browser already
 *    trusts this origin) and once more on the first pointer or key event. Music
 *    itself is started by the screens that own it (the title screen and the
 *    fight), so this provider never restarts it on every keystroke.
 *
 * 2. UI sounds, by delegation. One pair of document listeners gives every
 *    control a hover tick and a press click — including controls added later and
 *    inside modals — without threading a callback through each button.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fightAudio } from '@/fight/audio';

/** What counts as a control for hover/press feedback. */
const CONTROL = 'button, [role="button"], a[href]';

interface AudioApi {
  muted: boolean;
  toggleMuted: () => void;
}

const AudioContextValue = createContext<AudioApi | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(() => fightAudio.isMuted());

  useEffect(() => {
    void fightAudio.unlock();

    /* First gesture only: resume the context, then step aside. */
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      void fightAudio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const onOver = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(CONTROL);
      if (!target || target.hasAttribute('disabled')) return;
      /* pointerover also fires when moving between a control's own children;
       * only sound when the pointer actually enters a different control. */
      const from = (event.relatedTarget as Element | null)?.closest?.(CONTROL);
      if (from === target) return;
      fightAudio.hover();
    };

    const onDown = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(CONTROL);
      if (!target || target.hasAttribute('disabled')) return;
      fightAudio.press();
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerdown', onDown);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerdown', onDown);
    };
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted(fightAudio.toggle());
  }, []);

  const value = useMemo(() => ({ muted, toggleMuted }), [muted, toggleMuted]);

  return (
    <AudioContextValue.Provider value={value}>
      {children}
    </AudioContextValue.Provider>
  );
}

export function useGameAudio(): AudioApi {
  const value = useContext(AudioContextValue);
  if (!value) throw new Error('useGameAudio must be used inside <AudioProvider>');
  return value;
}
