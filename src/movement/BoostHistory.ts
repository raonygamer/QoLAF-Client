interface BoostWindow {
  start: number;
  end: number;
  confirmed: boolean;
}

/** PlayerShip's timestamped boost windows, including authoritative acknowledgement matching. */
export class BoostHistory {
  private windows: BoostWindow[] = [];

  reset(): void {
    this.windows.length = 0;
  }

  add(stamp: number, duration: number, now: number, confirmed = false): void {
    this.prune(now);
    this.windows.push({ start: stamp, end: stamp + duration, confirmed });
  }

  /** False means a repeated acknowledgement; it must not consume a newer prediction. */
  confirm(stamp: number, duration: number, now: number): boolean {
    this.prune(now);
    let nearest: BoostWindow | null = null;
    let distance = Infinity;
    for (const window of this.windows) {
      const delta = Math.abs(window.start - stamp);
      if (window.confirmed && delta <= 66) return false;
      if (!window.confirmed && delta < distance) {
        nearest = window;
        distance = delta;
      }
    }
    if (nearest) {
      nearest.start = stamp;
      nearest.end = stamp + duration;
      nearest.confirmed = true;
    } else this.add(stamp, duration, now, true);
    this.prune(now);
    return true;
  }

  activeAt(time: number): boolean {
    return this.windows.some((window) => time >= window.start && time < window.end);
  }

  private prune(now: number): void {
    for (let index = this.windows.length - 1; index >= 0; index--)
      if (this.windows[index].end < now - 5000) this.windows.splice(index, 1);
  }
}

export function boostReadyAt(stamp: number, cooldown: number, reduction: number): number {
  return stamp + cooldown * (reduction > 0.4 ? 0.6 : 1 - reduction);
}
