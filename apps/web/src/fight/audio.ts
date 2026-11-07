import { Howl, Howler } from 'howler';

export type MusicMode = 'menu' | 'fight';
export type AudioLevels = { master: number; music: number; effects: number; voice: number };
type HitStrength = 'light' | 'medium' | 'heavy' | 'critical';
type Manifest = { revision?: string; samples?: string[]; music?: Partial<Record<MusicMode, string>>; ambience?: Record<string, string>; voices?: Record<string, string>; roundCues?: Record<string, { fightAt: number }> };
type VoiceJob = { cue: string; priority: number };
const BASE = import.meta.env.BASE_URL + 'audio/';
const SETTINGS_KEY = 'veilstrike:audio:v3';
const MUTE_KEY = 'veilstrike:muted:v2';
const DEFAULTS: AudioLevels = { master: .82, music: .55, effects: .88, voice: .92 };
const ULTIMATES: Record<string, string> = { karen: 'Steel resolve!', taren: 'Hold the line!', nomet: 'Last burial!', veyra: 'Captive steel!', mawren: 'Rune collapse!', neris: 'Smoke execution!', vesper: 'Final dosage!', rhoven: 'Soulstorm!', seyra: 'Two as one!', varkesh: 'Furnace rupture!' };
const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const stem = (file: string) => file.replace(/\.(wav|mp3|ogg|webm)$/i, '');

/** Asset playback, separate channel levels, voice priorities, and music ducking. */
class FightAudio {
  private levels: AudioLevels = { ...DEFAULTS };
  private muted = false;
  private suspended = false;
  private manifest: Manifest = {};
  private samples = new Map<string, Howl>();
  private voices = new Map<string, Howl>();
  private music: Howl | null = null;
  private ambience: Howl | null = null;
  private musicTracks = new Map<MusicMode, Howl>();
  private ambienceTracks = new Map<string, Howl>();
  private mode: MusicMode | null = null;
  private arenaMusicEnded = false;
  private arena = 'sanctum';
  private manifestReady = false;
  private voiceJob: VoiceJob | null = null;
  private voiceHowl: Howl | null = null;
  private voiceId: number | null = null;
  private roundGate: { round: number; released: boolean } | null = null;
  private voiceQueue: VoiceJob[] = [];
  private lastVoices = new Map<string, number>();
  private lastVoiceAt = -10000;
  private voiceTimer: number | null = null;
  private ctx: AudioContext | null = null;
  private listeners = new Set<() => void>();
  private audit: { type: string; name: string; at: number }[] = [];
  readonly ready: Promise<void>;

  constructor() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<AudioLevels> | null;
      if (stored) for (const key of Object.keys(DEFAULTS) as (keyof AudioLevels)[]) if (typeof stored[key] === 'number') this.levels[key] = clamp(stored[key]!);
      this.muted = localStorage.getItem(MUTE_KEY) === 'true';
    } catch { /* Use defaults when storage is unavailable. */ }
    Howler.volume(this.levels.master); Howler.mute(this.muted);
    this.ready = this.load();
    if (import.meta.env.DEV) Object.assign(window, { __veilstrikeAudio: this });
  }
  private record(type: string, name: string): void {
    this.audit.push({ type, name, at: performance.now() });
    if (this.audit.length > 80) this.audit.shift();
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private changed(): void { for (const listener of this.listeners) listener(); }
  getLevels(): AudioLevels { return { ...this.levels }; }
  setLevels(next: Partial<AudioLevels>): void {
    for (const key of Object.keys(DEFAULTS) as (keyof AudioLevels)[]) if (typeof next[key] === 'number') this.levels[key] = clamp(next[key]!);
    Howler.volume(this.levels.master); this.applyVolumes();
    if (this.levels.effects === 0 || this.levels.master === 0) this.stopVoice();
    if (this.voiceHowl && this.voiceId != null) this.voiceHowl.volume(this.voiceVolume(), this.voiceId);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.levels)); } catch { /* Storage is optional. */ }
    this.changed();
  }
  resetLevels(): void { this.setLevels(DEFAULTS); }
  isMuted(): boolean { return this.muted; }
  toggle(): boolean {
    this.muted = !this.muted; Howler.mute(this.muted);
    if (this.muted) this.stopVoice(); else void this.unlock();
    try { localStorage.setItem(MUTE_KEY, String(this.muted)); } catch { /* Storage is optional. */ }
    this.changed(); return this.muted;
  }
  private async load(): Promise<void> {
    try {
      const response = await fetch(BASE + 'manifest.json');
      if (response.ok) this.manifest = await response.json() as Manifest;
      const revision = encodeURIComponent(this.manifest.revision ?? '4');
      for (const file of this.manifest.samples ?? []) this.samples.set(stem(file), new Howl({ src: [BASE + file + '?v=' + revision], preload: true, pool: 8 }));
      for (const [cue, file] of Object.entries(this.manifest.voices ?? {})) this.voices.set(cue, new Howl({ src: [BASE + file + '?v=' + revision], preload: true, volume: this.voiceVolume(), pool: 1, onloaderror: () => { this.voices.delete(cue); this.changed(); } }));
    } catch { /* Short procedural effects cover missing samples; unavailable voice stays silent. */ }
    this.manifestReady = true;
    if (this.mode) { const mode = this.mode; this.mode = null; this.startMusic(mode); }
    this.changed();
  }
  private context(): AudioContext | null {
    if (Howler.ctx) return Howler.ctx;
    if (!this.ctx) try { this.ctx = new AudioContext(); } catch { return null; }
    return this.ctx;
  }
  async unlock(): Promise<void> {
    const ctx = this.context();
    if (ctx?.state === 'suspended') await ctx.resume().catch(() => undefined);
  }
  private musicVolume(): number { return (this.mode === 'fight' ? .36 : .17) * this.levels.music * (this.voiceJob ? .24 : 1); }
  private voiceVolume(): number { return this.levels.effects * .92; }
  private applyVolumes(): void {
    if (this.music?.state() === 'loaded') this.music.fade(this.music.volume(), this.musicVolume(), 180);
    if (this.ambience?.state() === 'loaded') this.ambience.volume(this.levels.effects * (this.mode === 'fight' ? .13 : .045));
  }
  startMusic(mode: MusicMode = 'fight'): void {
    void this.unlock();
    if (this.mode === mode && this.music) return;
    this.mode = mode;
    if (mode === 'fight') this.arenaMusicEnded = false;
    if (this.music) { const old = this.music; if (old.state() === 'loaded') { old.fade(old.volume(), 0, 260); window.setTimeout(() => { if (this.music !== old) old.pause(); }, 320); } this.music = null; }
    const file = this.manifest.music?.[mode];
    if (file) {
      let next = this.musicTracks.get(mode);
      if (!next) {
        const track = new Howl({ src: [BASE + file], loop: mode === 'menu', volume: 0, onend: () => {
          if (mode === 'fight' && this.music === track) { this.arenaMusicEnded = true; this.record('music', 'fight-end'); }
        }, onload: () => {
          if (this.music === track && !this.suspended) { if (!track.playing()) track.play(); track.fade(track.volume(), this.musicVolume(), 600); }
        }});
        next = track; this.musicTracks.set(mode, track);
      }
      this.music = next;
      if (next.state() === 'loaded' && !this.suspended) { if (mode === 'fight') next.stop(); if (!next.playing()) next.play(); next.fade(next.volume(), this.musicVolume(), 600); }
    }
    this.setArena(this.arena); this.record('music', mode); this.changed();
  }
  stopMusic(): void {
    this.mode = null;
    if (this.music) { const old = this.music; if (old.state() === 'loaded') { old.fade(old.volume(), 0, 180); window.setTimeout(() => { if (this.music !== old) old.pause(); }, 240); } this.music = null; }
    if (this.ambience?.state() === 'loaded') this.ambience.pause(); this.ambience = null;
    this.stopVoice(); this.changed();
  }
  setArena(arena: string): void {
    this.arena = arena;
    if (this.ambience?.state() === 'loaded') this.ambience.pause(); this.ambience = null;
    const key = arena === 'forge' ? 'forge' : arena === 'grove' ? 'grove' : 'wind';
    const file = this.manifest.ambience?.[key];
    if (!file || !this.mode) return;
    let next = this.ambienceTracks.get(key);
    if (!next) {
      const track = new Howl({ src: [BASE + file], loop: true, volume: 0, onload: () => { if (this.ambience === track && !this.suspended) { track.volume(this.levels.effects * (this.mode === 'fight' ? .13 : .045)); track.play(); } } });
      next = track; this.ambienceTracks.set(key, track);
    }
    this.ambience = next;
    if (next.state() === 'loaded') { next.volume(this.levels.effects * (this.mode === 'fight' ? .13 : .045)); if (!this.suspended) next.play(); }
  }
  suspend(value: boolean): void {
    if (this.suspended === value) return;
    this.suspended = value;
    // Let load callbacks check the current screen; queued pauses can stop a reused track after loading.
    if (value) { if (this.music?.state() === 'loaded') this.music.pause(); if (this.ambience?.state() === 'loaded') this.ambience.pause(); for (const sound of this.samples.values()) if (sound.state() === 'loaded') sound.stop(); this.stopVoice(); }
    else { void this.unlock(); if (this.music?.state() === 'loaded' && (this.mode !== 'fight' || !this.arenaMusicEnded)) this.music.play(); if (this.ambience?.state() === 'loaded') this.ambience.play(); this.applyVolumes(); }
    this.changed();
  }
  private pick(name: string): Howl | null {
    const exact = this.samples.get(name);
    if (exact?.state() === 'loaded') return exact;
    const variants = [...this.samples].filter(([key, sound]) => key.startsWith(name + '-') && sound.state() === 'loaded');
    return variants.length ? variants[Math.floor(Math.random() * variants.length)]![1] : null;
  }
  sound(name: string, gain = .85, pan = 0): () => void {
    if (this.muted || (this.suspended && (!name.startsWith('ui-') || document.hidden)) || this.levels.effects <= 0 || this.levels.master <= 0) return () => {};
    const sound = this.pick(name);
    let stop = () => {};
    if (sound) {
      const id = sound.play(); sound.volume(clamp(gain * this.levels.effects), id);
      sound.rate(/^(ui-|spin-|round-|victory|defeat|draw)/.test(name) ? 1 : .95 + Math.random() * .1, id); sound.stereo(Math.max(-.8, Math.min(.8, pan)), id);
      stop = () => { sound.stop(id); };
    } else this.fallback(name, gain * this.levels.effects);
    this.record('effect', name);
    return stop;
  }
  private fallback(name: string, volume: number): void {
    const ctx = this.context(); if (!ctx || ctx.state !== 'running') return;
    const length = name.includes('heavy') ? .35 : .13, frames = Math.round(ctx.sampleRate * length);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / frames * 7);
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = /swing|parry|clash/.test(name) ? 2800 : 750;
    gain.gain.value = volume * .42 * (Howler.ctx ? 1 : this.levels.master);
    source.connect(filter); filter.connect(gain); gain.connect(Howler.masterGain ?? ctx.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); }; source.start();
  }
  announce(cue: string, priority = 2, force = false): void {
    if (cue.startsWith('round-fight-')) this.roundGate = { round: Number(cue.slice(12)), released: false };
    if (this.muted || this.suspended || this.levels.effects <= 0 || this.levels.master <= 0) return;
    if (this.voices.get(cue)?.state() !== 'loaded') return;
    const now = performance.now(), cooldown = priority <= 5 ? 14000 : 2500;
    if (!force && (now - (this.lastVoices.get(cue) ?? -100000) < cooldown || this.voiceJob?.cue === cue)) return;
    const job = { cue, priority }; this.lastVoices.set(cue, now);
    if (this.voiceJob) {
      if (force || priority > this.voiceJob.priority) this.stopVoice(false);
      else return;
    } else if (!force && priority <= 5 && now - this.lastVoiceAt < 6500) return;
    this.voiceJob = job; this.lastVoiceAt = now; this.applyVolumes(); this.record('voice', cue);
    const sound = this.voices.get(cue);
    const end = () => this.finishVoice(job);
    if (sound?.state() === 'loaded') {
      const id = sound.play(); this.voiceHowl = sound; this.voiceId = id; sound.volume(this.voiceVolume(), id);
      sound.once('end', end, id); sound.once('playerror', end, id);
    } else { end(); return; }
    if (this.voiceJob === job) this.voiceTimer = window.setTimeout(end, 7000);
    this.changed();
  }
  private finishVoice(job: VoiceJob): void {
    if (this.voiceJob !== job) return;
    if (job.cue === 'round-fight-' + this.roundGate?.round) this.roundGate!.released = true;
    if (this.voiceTimer != null) window.clearTimeout(this.voiceTimer);
    this.voiceTimer = null; this.voiceHowl = null; this.voiceId = null; this.voiceJob = null;
    this.applyVolumes(); this.changed();
    const next = this.voiceQueue.shift(); if (next) this.announce(next.cue, next.priority, true);
  }
  private stopVoice(clearQueue = true): void {
    this.voiceHowl?.stop(); this.voiceHowl = null; this.voiceId = null;
    if (this.voiceTimer != null) window.clearTimeout(this.voiceTimer);
    this.voiceTimer = null; this.voiceJob = null;
    if (clearQueue) this.voiceQueue = [];
    this.applyVolumes();
  }
  status() { return { mode: this.mode, arena: this.arena, muted: this.muted, suspended: this.suspended, levels: this.getLevels(), manifestReady: this.manifestReady, effectsLoaded: [...this.samples.values()].filter(s => s.state() === 'loaded').length, voicesLoaded: [...this.voices.values()].filter(s => s.state() === 'loaded').length, voice: this.voiceJob?.cue ?? null, musicPlaying: this.music?.playing() ?? false, musicVolume: this.music?.volume() ?? 0, events: [...this.audit] }; }

  roundReleased(round: number): boolean {
    const cue = 'round-fight-' + round;
    if (this.muted || this.levels.effects <= 0 || this.levels.master <= 0 || (this.manifestReady && !this.voices.has(cue))) return true;
    if (this.roundGate?.round !== round) return false;
    if (this.roundGate.released) return true;
    if (this.voiceJob?.cue === cue && this.voiceHowl && this.voiceId !== null) {
      if (this.voiceHowl.playing(this.voiceId) && this.voiceHowl.seek() >= (this.manifest.roundCues?.[cue]?.fightAt ?? 1.025)) { this.roundGate.released = true; this.record('round', 'fight-' + round); }
    } else if (!this.voiceJob && !this.suspended && this.voices.get(cue)?.state() === 'loaded') this.announce(cue, 8, true);
    return this.roundGate.released;
  }

  hover(): void { if (this.context()?.state === 'running') this.sound('ui-hover', .16); }
  press(): void { this.sound('ui-click', .38); }
  ui(): void { this.press(); }
  entry(): void { this.sound('round-start', .45); }
  round(): void { this.sound('round-start', .45); }
  fight(): void { this.announce('fight', 8, true); }
  victory(): void { this.announce('victory', 10, true); }
  defeat(): void { this.announce('defeat', 10, true); }
  swing(heavy = false, ..._rest: unknown[]): void { this.sound('weapon-swing', heavy ? .9 : .65); }
  hit(strength: HitStrength, bladed = false, ..._rest: unknown[]): void { this.sound(strength === 'light' ? 'body-hit' : 'heavy-impact', strength === 'critical' ? 1 : .85); if (bladed) this.sound('weapon-swing', .2); }
  combatImpact(heavy: boolean, fists: boolean, pan: number, knockdown = false): void {
    this.sound(fists ? heavy ? 'punch-heavy' : 'punch-impact' : 'blade-hit', heavy ? .9 : .8, pan);
    if (heavy && !fists) this.sound('heavy-impact', .55, pan);
    if (knockdown) this.sound('body-fall', .75, pan);
  }
  block(bladed = true, ..._rest: unknown[]): void { this.sound(bladed ? 'metal-clash' : 'body-hit', .62); }
  parry(..._rest: unknown[]): void { this.sound('parry', .88); }
  guardBreak(..._rest: unknown[]): void { this.sound('metal-clash'); this.sound('heavy-impact', .7); }
  dodge(..._rest: unknown[]): void { this.sound('dodge', .46); }
  dash(..._rest: unknown[]): void { this.sound('dodge', .45); }
  jump(..._rest: unknown[]): void { this.sound('dodge', .3); }
  land(..._rest: unknown[]): void { this.sound('footstep-stone', .7); }
  footstep(intensity = 1, surface = 'stone', ..._rest: unknown[]): void { this.sound('footstep-' + surface, .36 * intensity); }
  exhausted(..._rest: unknown[]): void { this.sound('dodge', .15); }
  ability(skill = 'rune', ..._rest: unknown[]): void {
    const key: Record<string, string> = { blade: 'blade-toss', oath: 'shield-charge', grave: 'ground-slam', chain: 'chain', rune: 'rune', snare: 'smoke', poison: 'poison', scatter: 'spirit', divided: 'spirit', furnace: 'fire' };
    this.sound(key[skill] ?? 'rune', .9);
  }
  ultimate(id = '', skill = 'rune', ..._rest: unknown[]): void { this.ability(skill); this.sound('heavy-impact', .65); if (ULTIMATES[id]) this.announce('ultimate-' + id, 5); }
}

export const fightAudio = new FightAudio();
