import { createMockRoom } from '@flayerlabs/gamemode-client';
import { defineGame, type Command } from '@flayerlabs/gamemode-spec';

export interface DuelConfig { maxPoints: number }
export interface DuelState { opensAt: number; closesAt: number; points: Record<string, number>; events: number }
export type DuelAction = { type: 'hit' | 'special' | 'win' };
export interface VeilstrikeView { phase: 'open' | 'closed'; points: Record<string, number>; events: number }

export const rules = defineGame<DuelConfig, DuelState, { type: 'scored'; player: string; points: number }, DuelAction, VeilstrikeView, VeilstrikeView>({
  id: 'veilstrike',
  parseAction(input) {
    if (!input || typeof input !== 'object') return null;
    const type = (input as { type?: unknown }).type;
    return type === 'hit' || type === 'special' || type === 'win' ? { type } : null;
  },
  initRound(config, seed, window) { void config; void seed; return { opensAt: window.opensAt, closesAt: window.closesAt, points: {}, events: 0 }; },
  decide(state, command: Command<DuelAction>) {
    if (command.kind !== 'action') return { events: [] };
    if (command.at < state.opensAt || command.at > state.closesAt) return { refuse: 'closed' };
    const points = command.action.type === 'win' ? 250 : command.action.type === 'special' ? 40 : 10;
    return { events: [{ type: 'scored', player: command.player, points }], awards: [{ player: command.player, points }] };
  },
  evolve(state, event) { return { ...state, points: { ...state.points, [event.player]: (state.points[event.player] ?? 0) + event.points }, events: state.events + 1 }; },
  publicView(state) { return { phase: state.events >= 0 && state.closesAt > state.opensAt ? 'open' : 'closed', points: { ...state.points }, events: state.events }; },
  playerView(state) { return this.publicView(state); },
  nextWakeAt(state) { return state.closesAt > state.opensAt ? state.closesAt : null; },
  rewardBounds(config) { return { maxPointsPerPlayer: config.maxPoints }; },
});

export function createVeilstrikeRoom() {
  return createMockRoom(rules, { config: { maxPoints: 300 }, roundMs: 90_000, lobbyMs: 0 });
}
