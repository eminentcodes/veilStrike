/*
 * `@/audio/engine` — compatibility shim.
 *
 * The fighting game (VEILSTRIKE) runs entirely on `@/fight/audio` (Howler + a
 * small Web-Audio procedural voice). A few older mining-game files still import
 * `audio` from here, so rather than rewrite them this module re-exposes the tiny
 * slice they use and forwards each call to the one real engine.
 *
 * There is no Tone.js anywhere behind this any more.
 */

import { fightAudio } from '@/fight/audio';

type MusicMode = 'menu' | 'fight';

export const audio = {
  get muted(): boolean {
    return fightAudio.isMuted();
  },
  setMuted(next: boolean): void {
    if (fightAudio.isMuted() !== next) fightAudio.toggle();
  },
  unlock(): Promise<void> {
    return fightAudio.unlock();
  },
  startMusic(mode: MusicMode = 'menu'): void {
    fightAudio.startMusic(mode);
  },
  stopMusic(): void {
    fightAudio.stopMusic();
  },

  /* UI */
  hover(): void {
    fightAudio.hover();
  },
  press(): void {
    fightAudio.press();
  },
  chime(): void {
    fightAudio.round();
  },
  alert(): void {
    fightAudio.press();
  },

  /* mining-game cues mapped onto combat voices */
  mine(): void {
    fightAudio.swing(false);
  },
  collect(): void {
    fightAudio.press();
  },
  deposit(): void {
    fightAudio.round();
  },
};
