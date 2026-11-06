import type { DuelConfig, ArenaId } from './catalog';
import type { ChampionId } from './catalog';
import type { DuelSnapshot, InputFrame, Slot } from './simulation';

export interface RoomInfo {
  code: string; status: 'waiting' | 'loading' | 'fighting'; arena: ArenaId;
  players: [{ fighter: ChampionId; name: string; ready: boolean } | null, { fighter: ChampionId; name: string; ready: boolean } | null];
}
export class RoomConnection {
  readonly socket: WebSocket;
  slot: Slot = 0;
  info: RoomInfo | null = null;
  config: DuelConfig | null = null;
  snapshot: DuelSnapshot | null = null;
  error = '';
  private listeners = new Set<() => void>();
  private disposed = false;
  private lastEvent = 0;
  private queuedEvents: DuelSnapshot['events'] = [];
  constructor() {
    const endpoint = import.meta.env.VITE_DUEL_SERVER_URL as string | undefined;
    const url = endpoint || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/duel';
    this.socket = new WebSocket(url);
    this.socket.addEventListener('message', event => {
      if (this.disposed) return;
      let data;
      try { data = JSON.parse(String(event.data)); } catch { return; }
      if (data.type === 'seat') this.slot = data.slot === 1 ? 1 : 0;
      if (data.type === 'room') this.info = data;
      if (data.type === 'start') this.config = data.config;
      if (data.type === 'state') {
        this.snapshot = data.snapshot;
        for (const event of this.snapshot?.events ?? []) if (event.id > this.lastEvent) { this.queuedEvents.push(event); this.lastEvent = event.id; }
        if (this.queuedEvents.length > 120) this.queuedEvents.splice(0, this.queuedEvents.length - 120);
      }
      if (data.type === 'error' || data.type === 'closed') this.error = data.message;
      this.notify();
    });
    this.socket.addEventListener('close', () => { if (!this.disposed) { this.error = 'Arena connection closed. Return to the lobby to reconnect.'; this.notify(); } });
    this.socket.addEventListener('error', () => { if (!this.disposed) { this.error = 'Could not reach the PvP arena server.'; this.notify(); } });
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(): void { for (const listener of this.listeners) listener(); }
  async connect(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('The PvP server is not responding.')); }, 8000);
      const open = () => { cleanup(); resolve(); };
      const error = () => { cleanup(); reject(new Error('Could not connect to the PvP server.')); };
      const cleanup = () => { window.clearTimeout(timeout); this.socket.removeEventListener('open', open); this.socket.removeEventListener('error', error); this.socket.removeEventListener('close', error); };
      this.socket.addEventListener('open', open, { once: true }); this.socket.addEventListener('error', error, { once: true }); this.socket.addEventListener('close', error, { once: true });
    });
  }
  create(fighter: ChampionId, arena: ArenaId, name: string): void { this.send({ type: 'create', fighter, arena, name }); }
  join(code: string, fighter: ChampionId, name: string): void { this.send({ type: 'join', code, fighter, name }); }
  ready(): void { this.send({ type: 'ready' }); }
  loaded(): void { this.send({ type: 'loaded' }); }
  input(input: InputFrame): void { this.send({ type: 'input', input }); }
  drainEvents(): DuelSnapshot['events'] { return this.queuedEvents.splice(0); }
  private send(message: unknown): void { if (!this.disposed && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
  dispose(): void { if (this.disposed) return; this.send({ type: 'leave' }); this.disposed = true; this.listeners.clear(); this.socket.close(); }
}

