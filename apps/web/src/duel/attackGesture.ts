/** Pair presses before committing so a double tap produces one heavy, never a light plus heavy. */
export const DOUBLE_ATTACK_MS = 200;
export class AttackGesture {
  private pending: number | null = null;
  private queued: ('light' | 'heavy')[] = [];
  press(now: number): void {
    if (this.pending !== null && now - this.pending <= DOUBLE_ATTACK_MS) {
      this.queued.push('heavy'); this.pending = null;
    } else {
      if (this.pending !== null) this.queued.push('light');
      this.pending = now;
    }
  }
  sample(now: number): 'light' | 'heavy' | null {
    if (this.pending !== null && now - this.pending > DOUBLE_ATTACK_MS) {
      this.queued.push('light'); this.pending = null;
    }
    return this.queued.shift() ?? null;
  }
  reset(): void { this.pending = null; this.queued = []; }
}
