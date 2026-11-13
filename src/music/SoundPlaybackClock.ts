/** Preserve native hot-load timestamps once, then measure intervals monotonically. */
export class SoundPlaybackClock {
  private readonly lastStarts = new WeakMap<object, number>();

  constructor(
    private readonly now = () => performance.now(),
    private readonly wallTime = () => Date.now(),
  ) {}

  accept(sound: object, overlapping: boolean, nativeLastStart: number): boolean {
    const now = this.now();
    let previous = this.lastStarts.get(sound);
    if (previous === undefined) {
      const elapsed = nativeLastStart > 0 ? Math.max(0, this.wallTime() - nativeLastStart) : 66;
      previous = now - elapsed;
      this.lastStarts.set(sound, previous);
    }
    if (overlapping && now - previous < 66) return false;
    this.lastStarts.set(sound, now);
    return true;
  }
}
