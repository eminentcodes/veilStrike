import { emptyInput } from './simulation';
import type { InputFrame } from './simulation';
import { AttackGesture } from './attackGesture';

export class DuelInput {
  private enabled = true;
  private held = new Set<string>();
  private edges = new Set<string>();
  private movement = { right: 0, forward: 0 };
  private attack = new AttackGesture();
  private host: HTMLElement;
  private alternate: boolean;
  private onMenu: () => void;
  private onLock: () => void;
  private onBlur: () => void;
  constructor(host: HTMLElement, onMenu: () => void, onLock: () => void, onBlur: () => void, alternate = false) {
    this.host = host; this.onMenu = onMenu; this.onLock = onLock; this.onBlur = onBlur; this.alternate = alternate;
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    host.addEventListener('pointerdown', this.pointerDown);
    window.addEventListener('pointerup', this.pointerUp);
    host.addEventListener('contextmenu', this.contextMenu);
  }
  private keyDown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true],dialog[open]')) return;
    if (event.code === 'Escape' && !this.alternate) { this.reset(); this.onMenu(); return; }
    if (!this.enabled || (['Space','Enter','Tab'].includes(event.code) && (event.target as HTMLElement)?.closest('button,a[href]'))) return;
    if (event.code === 'Tab' && !this.alternate) { event.preventDefault(); if (!event.repeat) this.onLock(); return; }
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
    if (!this.held.has(event.code) && !event.repeat) this.press(event.code);
    this.held.add(event.code);
  };
  private keyUp = (event: KeyboardEvent) => { this.held.delete(event.code); };
  private pointerDown = (event: PointerEvent) => {
    if (!this.enabled || this.alternate || event.pointerType !== 'mouse' || (event.target as HTMLElement)?.closest('button,input,.duel-overlay')) return;
    if (event.button === 0) this.press('KeyJ');
    if (event.button === 2) this.held.add('KeyL');
  };
  private pointerUp = (event: PointerEvent) => { if (event.button === 2) this.held.delete('KeyL'); };
  private contextMenu = (event: Event) => event.preventDefault();
  private blur = () => { this.reset(); this.onBlur(); };
  private press(code: string): void {
    if (code === (this.alternate ? 'Numpad1' : 'KeyJ')) this.attack.press(performance.now());
    else this.edges.add(code);
  }
  setEnabled(value: boolean): void { this.enabled = value; if (!value) this.reset(); }
  inject(code: string, down: boolean): void { if (!down) { this.held.delete(code); return; } if (!this.enabled) return; if (!this.held.has(code)) this.press(code); this.held.add(code); }
  move(right: number, forward: number): void {
    if (!this.enabled) return;
    const x = Number.isFinite(right) ? right : 0, z = Number.isFinite(forward) ? forward : 0;
    const length = Math.max(1, Math.hypot(x, z));
    this.movement = { right: x / length, forward: z / length };
  }
  sample(basis: { forwardX: number; forwardZ: number; rightX: number; rightZ: number }, lockOn = true): InputFrame {
    const input = emptyInput();
    const left = this.alternate ? 'ArrowLeft' : 'KeyA', right = this.alternate ? 'ArrowRight' : 'KeyD';
    const forward = this.alternate ? 'ArrowUp' : 'KeyW', backward = this.alternate ? 'ArrowDown' : 'KeyS';
    const x = Number(this.held.has(right)) - Number(this.held.has(left)) + this.movement.right;
    const z = Number(this.held.has(forward)) - Number(this.held.has(backward)) + this.movement.forward;
    input.x = basis.rightX * x + basis.forwardX * z; input.z = basis.rightZ * x + basis.forwardZ * z;
    input.sprint = this.held.has(this.alternate ? 'ControlRight' : 'ShiftLeft') || (!this.alternate && this.held.has('ShiftRight'));
    input.guard = this.held.has(this.alternate ? 'Numpad3' : 'KeyL');
    const attack = this.attack.sample(performance.now());
    input.light = attack === 'light';
    input.heavy = attack === 'heavy';
    input.dodge = this.edges.has(this.alternate ? 'Numpad0' : 'Space');
    input.special = this.edges.has(this.alternate ? 'Numpad4' : 'KeyU');
    input.ultimate = this.edges.has(this.alternate ? 'Numpad5' : 'KeyI');
    input.jump = this.edges.has('KeyC'); input.grapple = this.edges.has('KeyE'); input.lockOn = lockOn;
    this.edges.clear(); return input;
  }
  pulse(code: string): void { if (this.enabled) this.press(code); }
  reset(): void { this.held.clear(); this.edges.clear(); this.attack.reset(); this.movement = { right: 0, forward: 0 }; }
  destroy(): void {
    this.reset();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur);
    this.host.removeEventListener('pointerdown', this.pointerDown); window.removeEventListener('pointerup', this.pointerUp); this.host.removeEventListener('contextmenu', this.contextMenu);
  }
}


