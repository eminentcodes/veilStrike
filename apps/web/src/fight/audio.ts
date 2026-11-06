import { Howl, Howler } from 'howler';

export type MusicMode = 'menu' | 'fight';
export type AudioLevels = { master: number; music: number; effects: number; voice: number };
type HitStrength = 'light' | 'medium' | 'heavy' | 'critical';
type Manifest = { samples?: string[]; music?: Partial<Record<MusicMode, string>>; ambience?: Record<string, string>; voices?: Record<string, string> };
type VoiceJob = { cue: string; priority: number };
const BASE = import.meta.env.BASE_URL + 'audio/';
const SETTINGS_KEY = 'veilstrike:audio:v3';
const MUTE_KEY = 'veilstrike:muted:v2';
const DEFAULTS: AudioLevels = { master: .82, music: .55, effects: .88, voice: .92 };
const WORDS: Record<string, string> = { welcome: 'Welcome to Veilstrike.', 'round-1': 'Round one.', 'round-2': 'Round two.', 'round-3': 'Final round.', 'round-4': 'The battle continues.', 'round-5': 'Last round.', fight: 'Fight!', victory: 'Victory.', defeat: 'Defeat.', draw: 'A draw.', parry: 'Perfect parry.', 'guard-break': 'Guard broken.', finish: 'Finish it.', 'ten-seconds': 'Ten seconds remain.' };
Object.assign(WORDS, { 'round-fight-1': 'Round one. Fight!', 'round-fight-2': 'Round two. Fight!', 'round-fight-3': 'Round three. Fight!', 'round-fight-4': 'Round four. Fight!', 'round-fight-5': 'Final round. Fight!' });
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
  private mode: MusicMode | null = null;
  private arena = 'sanctum';
  private manifestReady = false;
  private voiceJob: VoiceJob | null = null;
  private voiceHowl: Howl | null = null;
  private voiceId: number | null = null;
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
    if (this.levels.voice === 0 || this.levels.master === 0) this.stopVoice();
    if (this.voiceHowl && this.voiceId != null) this.voiceHowl.volume(this.levels.voice, this.voiceId);
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
      for (const file of this.manifest.samples ?? []) this.samples.set(stem(file), new Howl({ src: [BASE + file + '?v=4'], preload: true, pool: 8 }));
      for (const [cue, file] of Object.entries(this.manifest.voices ?? {})) this.voices.set(cue, new Howl({ src: [BASE + file], preload: true, volume: this.levels.voice, pool: 1 }));
    } catch { /* Short procedural effects and browser speech cover missing assets. */ }
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
  private applyVolumes(): void {
    if (this.music) this.music.fade(this.music.volume(), this.musicVolume(), 180);
    if (this.ambience) this.ambience.volume(this.levels.effects * (this.mode === 'fight' ? .13 : .045));
  }
  startMusic(mode: MusicMode = 'fight'): void {
    void this.unlock();
    if (this.mode === mode && this.music) return;
    this.mode = mode;
    if (this.music) { const old = this.music; old.fade(old.volume(), 0, 260); window.setTimeout(() => old.unload(), 320); this.music = null; }
    const file = this.manifest.music?.[mode];
    if (file) {
      const next = new Howl({ src: [BASE + file], loop: true, volume: 0, onload: () => {
        if (this.music === next && !this.suspended) { next.play(); next.fade(0, this.musicVolume(), 600); }
      }});
      this.music = next;
    }
    this.setArena(this.arena); this.record('music', mode); this.changed();
  }
  stopMusic(): void {
    this.mode = null;
    if (this.music) { const old = this.music; old.fade(old.volume(), 0, 180); window.setTimeout(() => old.unload(), 240); this.music = null; }
    this.ambience?.unload(); this.ambience = null;
    this.stopVoice(); this.changed();
  }
  setArena(arena: string): void {
    this.arena = arena;
    this.ambience?.unload(); this.ambience = null;
    const key = arena === 'forge' ? 'forge' : arena === 'grove' ? 'grove' : 'wind';
    const file = this.manifest.ambience?.[key];
    if (!file || !this.mode) return;
    const next = new Howl({ src: [BASE + file], loop: true, volume: this.levels.effects * (this.mode === 'fight' ? .13 : .045), onload: () => { if (this.ambience === next && !this.suspended) next.play(); } });
    this.ambience = next;
  }
  suspend(value: boolean): void {
    if (this.suspended === value) return;
    this.suspended = value;
    if (value) { this.music?.pause(); this.ambience?.pause(); this.stopVoice(); }
    else { void this.unlock(); this.music?.play(); this.ambience?.play(); }
    this.changed();
  }
  private pick(name: string): Howl | null {
    const exact = this.samples.get(name);
    if (exact?.state() === 'loaded') return exact;
    const variants = [...this.samples].filter(([key, sound]) => key.startsWith(name + '-') && sound.state() === 'loaded');
    return variants.length ? variants[Math.floor(Math.random() * variants.length)]![1] : null;
  }
  sound(name: string, gain = .85, pan = 0): void {
    if (this.muted || this.suspended || this.levels.effects <= 0 || this.levels.master <= 0) return;
    const sound = this.pick(name);
    if (sound) {
      const id = sound.play(); sound.volume(clamp(gain * this.levels.effects), id);
      sound.rate(.95 + Math.random() * .1, id); sound.stereo(Math.max(-.8, Math.min(.8, pan)), id);
    } else this.fallback(name, gain * this.levels.effects);
    this.record('effect', name);
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
    if (this.muted || this.suspended || this.levels.voice <= 0 || this.levels.master <= 0) return;
    if (this.voices.get(cue)?.state() !== 'loaded') return;
    const now = performance.now(), cooldown = ['parry', 'guard-break', 'finish'].includes(cue) ? 14000 : 2500;
    if (!force && (now - (this.lastVoices.get(cue) ?? -100000) < cooldown || this.voiceJob?.cue === cue)) return;
    const job = { cue, priority }; this.lastVoices.set(cue, now);
    if (this.voiceJob) {
      if (force || priority > this.voiceJob.priority) this.stopVoice(false);
      else { if (this.voiceQueue.length < 2 && !this.voiceQueue.some(v => v.cue === cue)) this.voiceQueue.push(job); return; }
    } else if (!force && priority <= 2 && now - this.lastVoiceAt < 3500) return;
    this.voiceJob = job; this.lastVoiceAt = now; this.applyVolumes(); this.record('voice', cue);
    const sound = this.voices.get(cue);
    const end = () => this.finishVoice(job);
    if (sound?.state() === 'loaded') {
      const id = sound.play(); this.voiceHowl = sound; this.voiceId = id; sound.volume(this.levels.voice, id);
      sound.once('end', end, id); sound.once('playerror', end, id);
    } else if ('speechSynthesis' in window) {
      const text = WORDS[cue] ?? (cue.startsWith('ultimate-') ? ULTIMATES[cue.slice(9)] : cue);
      if (!text) { end(); return; }
      const speech = new SpeechSynthesisUtterance(text); speech.lang = 'en-US'; speech.rate = .86; speech.pitch = .7; speech.volume = this.levels.voice * this.levels.master;
      const voices = window.speechSynthesis.getVoices();
      speech.voice = voices.find(v => /Guy|David|Mark|Daniel/i.test(v.name)) ?? voices.find(v => v.lang === 'en-US') ?? null;
      speech.onend = end; speech.onerror = end; window.speechSynthesis.speak(speech);
    } else { end(); return; }
    if (this.voiceJob === job) this.voiceTimer = window.setTimeout(end, 7000);
    this.changed();
  }
  private finishVoice(job: VoiceJob): void {
    if (this.voiceJob !== job) return;
    if (this.voiceTimer != null) window.clearTimeout(this.voiceTimer);
    this.voiceTimer = null; this.voiceHowl = null; this.voiceId = null; this.voiceJob = null;
    this.applyVolumes(); this.changed();
    const next = this.voiceQueue.shift(); if (next) this.announce(next.cue, next.priority, true);
  }
  private stopVoice(clearQueue = true): void {
    this.voiceHowl?.stop(); this.voiceHowl = null; this.voiceId = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (this.voiceTimer != null) window.clearTimeout(this.voiceTimer);
    this.voiceTimer = null; this.voiceJob = null;
    if (clearQueue) this.voiceQueue = [];
    this.applyVolumes();
  }
  status() { return { mode: this.mode, arena: this.arena, muted: this.muted, suspended: this.suspended, levels: this.getLevels(), manifestReady: this.manifestReady, effectsLoaded: [...this.samples.values()].filter(s => s.state() === 'loaded').length, voicesLoaded: [...this.voices.values()].filter(s => s.state() === 'loaded').length, voice: this.voiceJob?.cue ?? null, musicPlaying: this.music?.playing() ?? false, musicVolume: this.music?.volume() ?? 0, events: [...this.audit] }; }

  hover(): void { if (this.context()?.state === 'running') this.sound('ui-hover', .16); }
  press(): void { this.sound('ui-click', .38); }
  ui(): void { this.press(); }
  entry(): void { this.sound('round-start', .45); }
  round(): void { this.sound('round-start', .45); }
  fight(): void { this.announce('fight', 8, true); }
  victory(): void { this.sound('victory', .7); this.announce('victory', 10, true); }
  defeat(): void { this.sound('defeat', .7); this.announce('defeat', 10, true); }
  swing(heavy = false, ..._rest: unknown[]): void { this.sound('weapon-swing', heavy ? .9 : .65); }
  hit(strength: HitStrength, bladed = false, ..._rest: unknown[]): void { this.sound(strength === 'light' ? 'body-hit' : 'heavy-impact', strength === 'critical' ? 1 : .85); if (bladed) this.sound('weapon-swing', .2); }
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
    const key: Record<string, string> = { blade: 'weapon-swing', oath: 'metal-clash', grave: 'bone', chain: 'chain', rune: 'rune', snare: 'dodge', poison: 'poison', scatter: 'spirit', divided: 'spirit', furnace: 'fire' };
    this.sound(key[skill] ?? 'rune', .9);
  }
  ultimate(id = '', skill = 'rune', ..._rest: unknown[]): void { this.ability(skill); this.sound('heavy-impact', .65); if (ULTIMATES[id]) this.announce('ultimate-' + id, 5); }
}

export const fightAudio = new FightAudio();
