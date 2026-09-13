/*
 * fight/audio.ts — VEILSTRIKE combat & UI audio.
 *
 * Playback runs on Howler.js, the library this repo was designed around (see
 * public/audio/README.md). Two layers, so the fight is never silent:
 *
 *   1. Real samples. If `/audio/manifest.json` lists a sound, its file is loaded
 *      and played (CC0 battle SFX, a looping theme). Missing files never 404 —
 *      only names in the manifest are ever requested.
 *   2. A Web-Audio procedural voice. Any call with no matching sample is
 *      synthesised on the spot (impacts, swings, metal, a driving music bed).
 *      This is what plays before assets load, or if none are installed.
 *
 * No Tone.js. Sound is ON by default. `fightAudio` keeps the exact surface the
 * Phaser scene and the React shell were written against — extra arguments a
 * given voice no longer needs are accepted and ignored.
 */

import { Howl, Howler } from 'howler';

type MusicMode = 'menu' | 'fight';
type HitStrength = 'light' | 'medium' | 'heavy' | 'critical';

// Bumped key so any stale mute flag from an earlier build is ignored: sound
// starts ON for everyone, then remembers the player's own choice from here on.
const MUTE_KEY = 'veilstrike:muted:v2';
const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/`;
const MUSIC_VOLUME: Record<MusicMode, number> = { menu: 0.32, fight: 0.5 };

// Procedural fight theme — a 4-bar loop in A minor with a Phrygian-dominant
// turnaround (Am · F · G · E), on an eighth-note grid of 8 steps per bar.
const STEPS_PER_BAR = 8;
const FIGHT_CHORDS = [110.0, 87.31, 98.0, 82.41]; // A2 · F2 · G2 · E2
const MENU_CHORDS = [110.0, 82.41]; // A2 · E2 — slow and brooding
// Sparse lead motif, one entry per step (Hz, or null for a rest).
const FIGHT_LEAD: ReadonlyArray<number | null> = [
  440.0, null, null, 523.25, null, 587.33, null, null, // Am
  523.25, null, 440.0, null, 349.23, null, null, null, // F
  null, null, 392.0, null, 440.0, null, 493.88, null, // G
  440.0, null, null, null, 329.63, null, null, null, // E
];

interface Manifest {
  samples?: string[];
  music?: Partial<Record<MusicMode, string>>;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function readMuted(): boolean {
  try {
    const stored = localStorage.getItem(MUTE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    /* private mode / no storage — fall through to the default */
  }
  return false; // sound ON by default
}

/** Candidate sources for a base name; Howler picks the first it can decode. */
function sources(name: string): string[] {
  return [`${AUDIO_BASE}${name}.mp3`, `${AUDIO_BASE}${name}.ogg`, `${AUDIO_BASE}${name}.webm`];
}

/** One preloaded sound effect that fails gracefully to "not ready". */
class Sample {
  private howl: Howl | null;
  private loaded = false;

  constructor(name: string, volume = 1) {
    this.howl = new Howl({
      src: sources(name),
      volume,
      preload: true,
      onload: () => {
        this.loaded = true;
      },
      onloaderror: () => {
        this.loaded = false;
        this.howl = null;
      },
    });
  }

  get ready(): boolean {
    return this.loaded && this.howl != null;
  }

  play(rate = 1, volume?: number): void {
    const howl = this.howl;
    if (!howl || !this.loaded) return;
    const id = howl.play();
    if (rate !== 1) howl.rate(clamp(rate, 0.5, 4), id);
    if (volume != null) howl.volume(clamp(volume, 0, 1), id);
  }
}

/*
 * Procedural voice. A compact Web-Audio synth used whenever there is no sample.
 * It reuses Howler's AudioContext (so a single unlock and the global mute cover
 * everything); if Howler has not created one yet it makes its own and gates
 * every voice on the mute flag so the toggle still works.
 */
class Synth {
  muted = false;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private bedTimer: number | null = null;
  private bedBus: GainNode | null = null;
  private bedStep = 0;
  private bedNextTime = 0;

  private ensure(): AudioContext | null {
    if (this.ctx && this.out) return this.ctx;
    const shared = Howler.ctx as AudioContext | undefined;
    if (shared) {
      const gain = shared.createGain();
      gain.gain.value = 1;
      const master = Howler.masterGain as GainNode | undefined;
      gain.connect(master ?? shared.destination);
      this.ctx = shared;
      this.out = gain;
      return shared;
    }
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      this.ctx = ctx;
      this.out = gain;
      return ctx;
    } catch {
      return null;
    }
  }

  resume(): Promise<void> {
    const ctx = this.ctx;
    if (ctx && ctx.state === 'suspended') {
      return ctx.resume().then(() => undefined).catch(() => undefined);
    }
    return Promise.resolve();
  }

  /* --- primitives --- */

  private noise(
    duration: number,
    opts: { type: BiquadFilterType; freq: number; q?: number; gain: number; attack?: number; sweepTo?: number },
  ): void {
    const ctx = this.ensure();
    const out = this.out;
    if (!ctx || !out || this.muted) return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.freq;
    if (opts.q != null) filter.Q.value = opts.q;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    const attack = opts.attack ?? 0.005;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(opts.gain, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    if (opts.sweepTo != null) {
      filter.frequency.setValueAtTime(opts.freq, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo), t + duration);
    }
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(t);
    src.stop(t + duration + 0.03);
  }

  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain: number; attack?: number; glideTo?: number },
  ): void {
    const ctx = this.ensure();
    const out = this.out;
    if (!ctx || !out || this.muted) return;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    const attack = opts.attack ?? 0.005;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(opts.gain, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    if (opts.glideTo != null) {
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.glideTo), t + duration);
    }
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  private metal(duration: number, gain: number, base = 320): void {
    const ctx = this.ensure();
    const out = this.out;
    if (!ctx || !out || this.muted) return;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(gain, t);
    bus.gain.exponentialRampToValueAtTime(0.0006, t + duration);
    bus.connect(out);
    const shaper = ctx.createBiquadFilter();
    shaper.type = 'highpass';
    shaper.frequency.value = base * 0.8;
    shaper.connect(bus);
    const ratios = [1, 1.503, 2.017, 2.67, 3.19];
    for (const ratio of ratios) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = base * ratio;
      const partial = ctx.createGain();
      partial.gain.value = 1 / ratios.length;
      osc.connect(partial);
      partial.connect(shaper);
      osc.start(t);
      osc.stop(t + duration + 0.03);
    }
    this.noise(Math.min(0.08, duration), { type: 'highpass', freq: base * 1.4, gain: gain * 0.5 });
  }

  /* --- combat / flow voices (fallbacks) --- */

  swing(heavy: boolean): void {
    this.noise(heavy ? 0.28 : 0.18, {
      type: 'bandpass',
      freq: heavy ? 700 : 1100,
      q: 0.8,
      gain: heavy ? 0.5 : 0.34,
      sweepTo: heavy ? 240 : 420,
      attack: 0.01,
    });
    // A faint blade shimmer trailing the whoosh.
    this.tone(heavy ? 1800 : 2600, 0.12, {
      type: 'triangle',
      gain: heavy ? 0.08 : 0.05,
      glideTo: heavy ? 900 : 1500,
    });
  }

  hit(strength: HitStrength, bladed: boolean): void {
    const level: Record<HitStrength, number> = { light: 0.45, medium: 0.65, heavy: 0.9, critical: 1 };
    const g = level[strength];
    const heavy = strength === 'heavy' || strength === 'critical';
    // Contact transient — the sharp crack of the strike landing.
    this.noise(0.02, { type: 'highpass', freq: 3000, gain: g * 0.6, attack: 0.001 });
    // Body thump — a fast pitch-dropping sine (the mass behind the blow).
    this.tone(heavy ? 150 : 190, heavy ? 0.22 : 0.14, {
      type: 'sine',
      gain: g * 0.9,
      glideTo: heavy ? 45 : 70,
      attack: 0.002,
    });
    // Impact smack — filtered noise body (flesh/armor, deliberately not metal).
    this.noise(heavy ? 0.16 : 0.1, {
      type: 'lowpass',
      freq: heavy ? 900 : 1400,
      gain: g * 0.6,
    });
    // Sub boom you feel on the heavy connects.
    if (heavy) this.tone(70, 0.3, { type: 'sine', gain: g * 0.5, glideTo: 38 });
    // A bladed weapon adds a cutting slash *through* the target — an airy band
    // of noise sweeping downward, plus a brief edge zing. Never a ringing
    // clash: that timbre is reserved for a block/parry, so a connect and a
    // deflection never sound alike.
    if (bladed) {
      this.noise(heavy ? 0.14 : 0.09, {
        type: 'bandpass',
        freq: heavy ? 3200 : 4200,
        q: 1.4,
        gain: g * 0.4,
        sweepTo: heavy ? 900 : 1400,
        attack: 0.001,
      });
      this.tone(heavy ? 2600 : 3200, 0.06, { type: 'triangle', gain: g * 0.12, glideTo: heavy ? 1500 : 2000 });
    }
    // Critical connects add a deep, meaty crunch under the strike.
    if (strength === 'critical') {
      this.tone(120, 0.4, { type: 'sine', gain: 0.4, glideTo: 44 });
      this.noise(0.4, { type: 'lowpass', freq: 700, gain: 0.35, sweepTo: 200 });
    }
  }

  block(bladed = true): void {
    // Metal-on-guard deflection — a bright clash, unmistakably not a flesh hit.
    // A bladed strike rings; a blunt/fist strike lands duller against the guard.
    this.noise(0.05, { type: 'highpass', freq: bladed ? 4200 : 2600, gain: bladed ? 0.42 : 0.3, attack: 0.001 });
    this.metal(bladed ? 0.34 : 0.2, bladed ? 0.5 : 0.34, bladed ? 640 : 360);
    this.tone(bladed ? 260 : 180, 0.1, { type: 'square', gain: 0.16, glideTo: bladed ? 150 : 110 });
    // Ringing tail sliding down as the blow is turned aside (bladed only).
    if (bladed) this.noise(0.2, { type: 'bandpass', freq: 3000, q: 2, gain: 0.14, sweepTo: 1500 });
  }

  parry(): void {
    // Perfect deflection — a bright, ringing clash that sings upward.
    this.noise(0.05, { type: 'highpass', freq: 5000, gain: 0.5, attack: 0.001 });
    this.metal(0.5, 0.6, 560);
    this.tone(880, 0.22, { type: 'sine', gain: 0.22, glideTo: 1500 });
    this.tone(1320, 0.3, { type: 'triangle', gain: 0.12, glideTo: 1760 });
  }

  guardBreak(): void {
    this.metal(0.6, 0.6, 300);
    this.noise(0.3, { type: 'lowpass', freq: 700, gain: 0.5, sweepTo: 200 });
  }

  dodge(): void {
    this.noise(0.26, { type: 'highpass', freq: 500, gain: 0.3, sweepTo: 2600, attack: 0.02 });
  }

  dash(): void {
    this.noise(0.2, { type: 'bandpass', freq: 900, q: 1, gain: 0.34, sweepTo: 1800 });
  }

  jump(): void {
    this.tone(300, 0.16, { type: 'triangle', gain: 0.3, glideTo: 620 });
  }

  land(): void {
    this.noise(0.14, { type: 'lowpass', freq: 500, gain: 0.5 });
    this.tone(80, 0.14, { type: 'sine', gain: 0.4, glideTo: 45 });
  }

  footstep(intensity = 1): void {
    // A quiet foot plant: soft low thud + a short grit scuff. A little random
    // wobble per step so a walk never sounds like a metronome.
    const g = 0.16 * intensity;
    const wobble = 0.9 + Math.random() * 0.2;
    this.tone(96 * wobble, 0.08, { type: 'sine', gain: g, glideTo: 54 * wobble, attack: 0.002 });
    this.noise(0.05, { type: 'bandpass', freq: 2200 * wobble, q: 0.9, gain: g * 0.5, sweepTo: 1200 });
  }

  exhausted(): void {
    this.noise(0.5, { type: 'bandpass', freq: 380, q: 0.7, gain: 0.22, sweepTo: 240 });
  }

  ability(): void {
    this.tone(220, 0.4, { type: 'sawtooth', gain: 0.3, glideTo: 660 });
    this.metal(0.4, 0.3, 500);
    this.noise(0.4, { type: 'highpass', freq: 1200, gain: 0.2, sweepTo: 3000 });
  }

  ultimate(): void {
    this.tone(60, 0.7, { type: 'sine', gain: 0.6, glideTo: 40 });
    this.metal(0.7, 0.5, 260);
    this.tone(180, 0.7, { type: 'sawtooth', gain: 0.35, glideTo: 720 });
    this.noise(0.7, { type: 'lowpass', freq: 1400, gain: 0.4, sweepTo: 300 });
  }

  entry(): void {
    this.tone(196, 0.5, { type: 'sawtooth', gain: 0.32, glideTo: 294 });
    window.setTimeout(() => this.tone(294, 0.5, { type: 'sawtooth', gain: 0.3 }), 130);
  }

  round(): void {
    this.tone(660, 0.5, { type: 'sine', gain: 0.4 });
    this.tone(990, 0.5, { type: 'sine', gain: 0.2 });
  }

  fight(): void {
    this.tone(330, 0.5, { type: 'square', gain: 0.4, glideTo: 660 });
    window.setTimeout(() => this.metal(0.3, 0.4, 600), 40);
  }

  victory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => window.setTimeout(() => this.tone(note, 0.5, { type: 'triangle', gain: 0.34 }), i * 130));
  }

  defeat(): void {
    const notes = [392, 330, 262, 196];
    notes.forEach((note, i) =>
      window.setTimeout(() => this.tone(note, 0.6, { type: 'sawtooth', gain: 0.32, glideTo: note * 0.85 }), i * 170),
    );
  }

  ui(): void {
    this.tone(1200, 0.05, { type: 'square', gain: 0.16 });
  }

  hover(): void {
    this.tone(2000, 0.03, { type: 'sine', gain: 0.06 });
  }

  /* --- scheduled music voices (precise start times on the audio clock) --- */

  private noiseBurstAt(
    time: number,
    dest: AudioNode,
    dur: number,
    type: BiquadFilterType,
    freq: number,
    gain: number,
    q = 0.7,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, gain), time);
    g.gain.exponentialRampToValueAtTime(0.0006, time + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  /** Taiko-style war drum: a pitch-dropping sine with a noise crack on top. */
  private kickAt(time: number, dest: AudioNode, gain: number, top = 150): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(top, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0008, time + 0.24);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + 0.28);
    this.noiseBurstAt(time, dest, 0.012, 'highpass', 2200, gain * 0.5);
  }

  private snareAt(time: number, dest: AudioNode, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.1);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(gain * 0.5, time);
    bg.gain.exponentialRampToValueAtTime(0.0008, time + 0.14);
    osc.connect(bg);
    bg.connect(dest);
    osc.start(time);
    osc.stop(time + 0.16);
    this.noiseBurstAt(time, dest, 0.16, 'bandpass', 1800, gain * 0.9, 1.2);
  }

  private hatAt(time: number, dest: AudioNode, gain: number, open = false): void {
    this.noiseBurstAt(time, dest, open ? 0.11 : 0.035, 'highpass', 8000, gain);
  }

  /** Plucked bass note that follows the chord root. */
  private bassAt(time: number, dest: AudioNode, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 6, time);
    lp.frequency.exponentialRampToValueAtTime(freq * 2, time + dur);
    lp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  /** Sustained power chord (root · fifth · octave), lightly detuned for width. */
  private padAt(time: number, dest: AudioNode, root: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.08);
    g.gain.setValueAtTime(gain, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    lp.connect(g);
    g.connect(dest);
    const partials = [1, 1.5, 2];
    for (const mult of partials) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = root * mult;
        osc.detune.value = detune;
        const pg = ctx.createGain();
        pg.gain.value = 1 / (partials.length * 2);
        osc.connect(pg);
        pg.connect(lp);
        osc.start(time);
        osc.stop(time + dur + 0.03);
      }
    }
  }

  private leadAt(time: number, dest: AudioNode, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  /* --- procedural music bed (lookahead scheduler) --- */

  startBed(mode: MusicMode): void {
    const ctx = this.ensure();
    const out = this.out;
    if (!ctx || !out) return;
    this.stopBed();

    // Dedicated bus + compressor so the drums punch without clipping the mix.
    const bus = ctx.createGain();
    bus.gain.value = mode === 'fight' ? 0.7 : 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    bus.connect(comp);
    comp.connect(out);
    this.bedBus = bus;

    const bpm = mode === 'fight' ? 140 : 92;
    const stepDur = 60 / bpm / 2; // eighth-note grid
    this.bedStep = 0;
    this.bedNextTime = ctx.currentTime + 0.08;

    const schedule = (): void => {
      const active = this.ctx;
      const target = this.bedBus;
      if (!active || !target || this.bedTimer == null) return;
      // Schedule every step that falls inside the next lookahead window.
      while (this.bedNextTime < active.currentTime + 0.12) {
        if (!this.muted) this.scheduleStep(mode, this.bedStep, this.bedNextTime, target, stepDur);
        this.bedNextTime += stepDur;
        this.bedStep += 1;
      }
    };
    this.bedTimer = window.setInterval(schedule, 25);
    schedule();
  }

  private scheduleStep(mode: MusicMode, step: number, time: number, dest: AudioNode, stepDur: number): void {
    if (mode === 'menu') {
      const loopLen = MENU_CHORDS.length * STEPS_PER_BAR;
      const pos = step % loopLen;
      const bar = Math.floor(pos / STEPS_PER_BAR);
      const inBar = pos % STEPS_PER_BAR;
      const root = MENU_CHORDS[bar] ?? 110.0;
      if (inBar === 0) {
        this.padAt(time, dest, root, stepDur * STEPS_PER_BAR, 0.13);
        this.kickAt(time, dest, 0.34, 110);
        this.bassAt(time, dest, root, stepDur * 3, 0.15);
      }
      if (inBar === 4) this.bassAt(time, dest, root, stepDur * 3, 0.1);
      if (inBar === 6 && bar === 1) this.leadAt(time, dest, 880, 0.6, 0.05);
      return;
    }

    // fight — driving 4-bar loop (Am · F · G · E)
    const loopLen = FIGHT_CHORDS.length * STEPS_PER_BAR; // 32 steps
    const pos = step % loopLen;
    const bar = Math.floor(pos / STEPS_PER_BAR);
    const inBar = pos % STEPS_PER_BAR;
    const root = FIGHT_CHORDS[bar] ?? 110.0;

    // Harmonic pad at the top of each bar.
    if (inBar === 0) this.padAt(time, dest, root, stepDur * STEPS_PER_BAR, 0.1);

    // War drums: kick on beats 1 & 3, snare backbeat on 2 & 4, hats every eighth.
    if (inBar === 0 || inBar === 4) this.kickAt(time, dest, 0.85, 150);
    if (inBar === 6 && bar % 2 === 1) this.kickAt(time, dest, 0.55, 150);
    if (inBar === 2 || inBar === 6) this.snareAt(time, dest, 0.5);
    this.hatAt(time, dest, inBar % 2 === 0 ? 0.05 : 0.09);
    if (bar === 3 && inBar >= 6) this.snareAt(time, dest, 0.32); // end-of-loop fill

    // Bass ostinato: root pulse with an octave lift going into the next bar.
    const bassGain = inBar % 2 === 0 ? 0.22 : 0.13;
    this.bassAt(time, dest, inBar === 7 ? root * 2 : root, stepDur * 0.9, bassGain);

    // Lead motif on alternating loops so the groove breathes between phrases.
    if (Math.floor(step / loopLen) % 2 === 0) {
      const note = FIGHT_LEAD[pos];
      if (note != null) this.leadAt(time, dest, note, stepDur * 1.6, 0.12);
    }
  }

  stopBed(): void {
    if (this.bedTimer != null) {
      window.clearInterval(this.bedTimer);
      this.bedTimer = null;
    }
    const bus = this.bedBus;
    if (bus) {
      const ctx = this.ctx;
      if (ctx) {
        try {
          bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
          bus.gain.exponentialRampToValueAtTime(0.0006, ctx.currentTime + 0.12);
        } catch {
          /* ignore */
        }
      }
      window.setTimeout(() => bus.disconnect(), 220);
      this.bedBus = null;
    }
  }
}

class FightAudio {
  private muted: boolean;
  private readonly synth = new Synth();
  private readonly samples = new Map<string, Sample>();
  private musicNames: Partial<Record<MusicMode, string>> = {};
  private manifestReady = false;
  private currentMode: MusicMode | null = null;
  private pending: MusicMode | null = null;
  private music: Howl | null = null;

  constructor() {
    this.muted = readMuted();
    this.synth.muted = this.muted;
    try {
      Howler.mute(this.muted);
    } catch {
      /* Howler not initialised yet — mute is re-applied on first sound */
    }
    void this.loadManifest();
  }

  private async loadManifest(): Promise<void> {
    try {
      const res = await fetch(`${AUDIO_BASE}manifest.json`, { cache: 'no-cache' });
      if (res.ok) {
        const data = (await res.json()) as Manifest;
        for (const name of data.samples ?? []) {
          if (!this.samples.has(name)) this.samples.set(name, new Sample(name));
        }
        if (data.music) this.musicNames = data.music;
      }
    } catch {
      /* no manifest — procedural voice covers everything */
    }
    this.manifestReady = true;
    // A real theme may now be available for music that started procedurally.
    if (this.pending) {
      const mode = this.pending;
      this.currentMode = null;
      this.startMusic(mode);
    }
  }

  private pick(name: string): Sample | null {
    const sample = this.samples.get(name);
    return sample && sample.ready ? sample : null;
  }

  /** Small per-play pitch wobble so repeated hits do not sound identical. */
  private vary(): number {
    return 0.93 + Math.random() * 0.14;
  }

  unlock(): Promise<void> {
    const tasks: Array<Promise<void>> = [this.synth.resume()];
    const ctx = Howler.ctx as AudioContext | undefined;
    if (ctx && ctx.state !== 'running') {
      tasks.push(ctx.resume().then(() => undefined).catch(() => undefined));
    }
    return Promise.all(tasks).then(() => undefined);
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private setMuted(muted: boolean): void {
    this.muted = muted;
    this.synth.muted = muted;
    try {
      Howler.mute(muted);
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
    } catch {
      /* ignore */
    }
    if (!muted) void this.unlock();
  }

  startMusic(mode: MusicMode = 'fight'): void {
    void this.unlock();
    this.pending = mode;
    if (this.currentMode === mode) return;
    this.currentMode = mode;

    if (this.music) {
      const previous = this.music;
      previous.fade(previous.volume(), 0, 500);
      window.setTimeout(() => {
        previous.stop();
        previous.unload();
      }, 560);
      this.music = null;
    }
    this.synth.stopBed();

    const name = this.manifestReady ? this.musicNames[mode] : undefined;
    if (name) {
      const target = MUSIC_VOLUME[mode];
      const howl = new Howl({
        src: sources(name),
        loop: true,
        volume: 0,
        onloaderror: () => {
          if (this.currentMode === mode) this.synth.startBed(mode);
        },
      });
      howl.play();
      howl.fade(0, target, 800);
      this.music = howl;
    } else {
      this.synth.startBed(mode);
    }
  }

  stopMusic(): void {
    this.currentMode = null;
    this.pending = null;
    this.synth.stopBed();
    if (this.music) {
      const previous = this.music;
      previous.fade(previous.volume(), 0, 400);
      window.setTimeout(() => {
        previous.stop();
        previous.unload();
      }, 450);
      this.music = null;
    }
  }

  /* --- UI --- */

  hover(): void {
    this.synth.hover();
  }

  press(): void {
    const click = this.pick('ui-click');
    if (click) click.play(this.vary(), 0.7);
    else this.synth.ui();
  }

  ui(): void {
    this.press();
  }

  /* --- match flow --- */

  entry(): void {
    const s = this.pick('round-start') ?? this.pick('fight-call');
    if (s) s.play(0.92, 0.7);
    else this.synth.entry();
  }

  round(): void {
    const s = this.pick('round-start');
    if (s) s.play();
    else this.synth.round();
  }

  fight(): void {
    const s = this.pick('fight-call') ?? this.pick('round-start');
    if (s) s.play();
    else this.synth.fight();
  }

  victory(): void {
    const s = this.pick('victory');
    if (s) s.play();
    else this.synth.victory();
  }

  defeat(): void {
    const s = this.pick('defeat');
    if (s) s.play();
    else this.synth.defeat();
  }

  /* --- combat --- */

  swing(heavy = false, ..._rest: unknown[]): void {
    const s = this.pick('weapon-swing');
    if (s) s.play(this.vary() * (heavy ? 0.85 : 1.08), heavy ? 1 : 0.82);
    else this.synth.swing(heavy);
  }

  hit(strength: HitStrength, bladed = false, ..._rest: unknown[]): void {
    const heavy = strength === 'heavy' || strength === 'critical';
    const body = this.pick(heavy ? 'heavy-impact' : 'body-hit') ?? this.pick('body-hit') ?? this.pick('heavy-impact');
    if (body) {
      body.play(this.vary() * (strength === 'critical' ? 0.9 : 1));
      // A bladed connect layers a quick, quiet cut over the impact — the
      // swing sample, never metal-clash (that timbre belongs to blocks).
      if (bladed) this.pick('weapon-swing')?.play(this.vary() * 1.5, 0.4);
    } else {
      this.synth.hit(strength, bladed);
    }
  }

  block(bladed = true, ..._rest: unknown[]): void {
    const s = bladed
      ? (this.pick('metal-clash') ?? this.pick('body-hit'))
      : (this.pick('body-hit') ?? this.pick('metal-clash'));
    if (s) s.play(this.vary() * 1.1, 0.6);
    else this.synth.block(bladed);
  }

  parry(..._rest: unknown[]): void {
    const s = this.pick('parry') ?? this.pick('metal-clash');
    if (s) s.play(this.vary());
    else this.synth.parry();
  }

  guardBreak(..._rest: unknown[]): void {
    const metal = this.pick('metal-clash');
    const heavy = this.pick('heavy-impact');
    if (metal || heavy) {
      metal?.play(this.vary() * 0.9);
      heavy?.play(this.vary() * 0.8, 0.7);
    } else {
      this.synth.guardBreak();
    }
  }

  dodge(..._rest: unknown[]): void {
    const s = this.pick('dodge');
    if (s) s.play(this.vary());
    else this.synth.dodge();
  }

  dash(..._rest: unknown[]): void {
    const s = this.pick('dodge');
    if (s) s.play(this.vary() * 1.25, 0.8);
    else this.synth.dash();
  }

  jump(..._rest: unknown[]): void {
    const s = this.pick('dodge');
    if (s) s.play(this.vary() * 1.4, 0.5);
    else this.synth.jump();
  }

  land(..._rest: unknown[]): void {
    const s = this.pick('body-hit');
    if (s) s.play(this.vary() * 0.8, 0.65);
    else this.synth.land();
  }

  footstep(intensity = 1, ..._rest: unknown[]): void {
    const s = this.pick('footstep');
    if (s) s.play(this.vary(), 0.5 * intensity);
    else this.synth.footstep(intensity);
  }

  exhausted(..._rest: unknown[]): void {
    this.synth.exhausted();
  }

  ability(..._rest: unknown[]): void {
    const s = this.pick('metal-clash') ?? this.pick('heavy-impact');
    if (s) s.play(this.vary() * 1.1);
    else this.synth.ability();
  }

  ultimate(..._rest: unknown[]): void {
    const heavy = this.pick('heavy-impact');
    const metal = this.pick('metal-clash');
    if (heavy || metal) {
      heavy?.play(0.85);
      metal?.play(this.vary(), 0.8);
    } else {
      this.synth.ultimate();
    }
  }
}

export const fightAudio = new FightAudio();
