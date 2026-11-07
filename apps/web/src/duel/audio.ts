import type { ArenaId, Champion, ChampionId } from './catalog';
import type { DuelEvent, DuelSnapshot, Slot } from './simulation';

interface CombatAudio {
  sound: (name: string, gain?: number, pan?: number) => unknown;
  announce: (cue: string, priority?: number, force?: boolean) => void;
  combatImpact: (heavy: boolean, fists: boolean, pan: number) => void;
  ultimate: (id: string, skill: string) => void;
}

export function arenaSurface(arena: ArenaId): string {
  return arena === 'forge' ? 'metal' : arena === 'grove' ? 'earth' : arena === 'citadel' ? 'snow' : 'stone';
}

/** Impacts follow contact, floor sounds follow landing, and footsteps follow travel. */
export class DuelSoundscape {
  private surface: string;
  private floorPlayed = [false, false];
  private equipmentPlayed = [false, false];
  private collapsePlayed = [false, false];
  private getupPlayed = [false, false];
  private positions: ({ x: number; z: number; distance: number } | null)[] = [null, null];
  private resultRound = 0;

  constructor(arena: ArenaId, private audio: CombatAudio, private champions: Record<ChampionId, Champion>) {
    this.surface = arenaSurface(arena);
  }

  event(event: DuelEvent, snapshot: DuelSnapshot, viewer: Slot): void {
    const fighter = this.champions[snapshot.fighters[event.slot].id];
    const fists = fighter.skill === 'grave' || fighter.skill === 'furnace';
    const pan = (event.target ?? event.slot) === viewer ? -.18 : .18;
    const sound = (name: string, gain = .7) => this.audio.sound(name, gain, pan);
    if (event.kind === 'release') {
      if (event.move === 'light' || event.move === 'heavy') sound(fists ? 'fist-swing' : 'weapon-swing', event.move === 'heavy' ? .72 : .5);
      else if (event.move === 'special') {
        const cues: Record<string, string> = { blade: 'blade-toss', oath: 'shield-charge', grave: 'ground-slam', chain: 'chain', rune: 'rune', snare: 'smoke', poison: 'poison', scatter: 'spirit', divided: 'spirit', furnace: 'fire' };
        sound(cues[fighter.skill] ?? 'rune', .85);
        if (fighter.skill === 'grave') sound('bone', .4);
        this.audio.announce('signature-' + fighter.id, 4);
      }
    } else if (event.kind === 'hit') {
      const magic = (event.move === 'special' || event.move === 'ultimate') && ['rune', 'poison', 'scatter', 'divided', 'furnace'].includes(fighter.skill);
      if (magic) { sound('body-hit', .65); sound(fighter.skill === 'furnace' ? 'fire' : fighter.skill === 'poison' ? 'poison' : fighter.skill === 'rune' ? 'rune' : 'spirit', .55); }
      else this.audio.combatImpact(event.move !== 'light', fists, pan);
      if (event.target !== undefined && this.champions[snapshot.fighters[event.target].id].skill === 'oath') sound('armor-hit', .25);
      if (event.knockdown) this.audio.announce('heavy-impact', 3);
      else if (event.move === 'heavy' && (event.damage ?? 0) >= 18) this.audio.announce('crushing-blow', 3);
    } else if (event.kind === 'guard') sound(fighter.skill === 'oath' ? 'shield-block' : fists ? 'body-block' : 'metal-clash', .64);
    else if (event.kind === 'parry') { sound('parry', .74); this.audio.announce('parry', 1); }
    else if (event.kind === 'break') { sound('guard-break', .82); this.audio.announce('guard-break', 2); }
    else if (event.kind === 'dodge') sound('dodge', .42);
    else if (event.kind === 'jump') sound('jump', .38);
    else if (event.kind === 'spell') sound('ability-charge', .3);
    else if (event.kind === 'ultimate') this.audio.ultimate(fighter.id, fighter.skill);
    else if (event.kind === 'round') { sound('round-start', .45); this.audio.announce('round-fight-' + snapshot.round, 8, true); }
    else if (event.kind === 'grab') sound('grapple-grab', .62);
    else if (event.kind === 'throw') sound('throw-swing', .72);
    else if (event.kind === 'land') {
      const falling = ['thrown', 'knockdown', 'dead'].includes(snapshot.fighters[event.slot].state);
      sound(falling ? 'body-fall' : 'land-' + this.surface, falling ? .8 : .55);
      if (falling) this.floorPlayed[event.slot] = true;
    } else if (event.kind === 'death') sound('defeat-impact', .5);
  }

  update(snapshot: DuelSnapshot, viewer: Slot): void {
    snapshot.fighters.forEach((fighter, slot) => {
      const pan = slot === viewer ? -.18 : .18;
      const sound = (name: string, gain: number) => this.audio.sound(name, gain, pan);
      if (fighter.state !== 'knockdown' && fighter.state !== 'thrown') this.floorPlayed[slot] = false;
      if (fighter.state === 'knockdown' && fighter.stateTime >= .55 && !this.floorPlayed[slot]) { sound('body-fall', .72); this.floorPlayed[slot] = true; }
      if (fighter.state !== 'dead') { this.equipmentPlayed[slot] = false; this.collapsePlayed[slot] = false; }
      else {
        if (fighter.stateTime >= .5 && !this.equipmentPlayed[slot]) {
          const skill = this.champions[fighter.id].skill;
          if (skill !== 'grave' && skill !== 'furnace') sound('equipment-drop', .55);
          this.equipmentPlayed[slot] = true;
        }
        if (fighter.stateTime >= .95 && !this.collapsePlayed[slot]) { sound('body-collapse', .44); this.collapsePlayed[slot] = true; }
      }
      if (fighter.state !== 'getup') this.getupPlayed[slot] = false;
      else if (!this.getupPlayed[slot]) { sound('getup', .34); this.getupPlayed[slot] = true; }

      const previous = this.positions[slot];
      const moving = snapshot.phase === 'fight' && (fighter.state === 'move' || fighter.state === 'sprint') && fighter.y === 0;
      const travel = previous ? Math.hypot(fighter.x - previous.x, fighter.z - previous.z) : 0;
      let distance = moving && travel < 2 ? (previous?.distance ?? 0) + travel : 0;
      const stride = fighter.state === 'sprint' ? 1.3 : .9;
      if (distance >= stride) { sound('footstep-' + this.surface, (fighter.state === 'sprint' ? .4 : .27) * (slot === viewer ? 1 : .8)); distance %= stride; }
      this.positions[slot] = { x: fighter.x, z: fighter.z, distance };
    });
    if (snapshot.phase === 'roundEnd' && snapshot.phaseTime >= .85 && this.resultRound !== snapshot.round) {
      this.resultRound = snapshot.round;
      this.audio.sound(snapshot.winner === null ? 'round-draw' : snapshot.winner === viewer ? 'round-win' : 'round-loss', .5);
    }
  }
}
