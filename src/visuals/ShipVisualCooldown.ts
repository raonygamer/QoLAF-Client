/** One source /sv cooldown shared by the native visual editors for a game session. */
export class ShipVisualCooldown {
  private static sessions = new WeakMap<object, ShipVisualCooldown>();
  private lastApplied = -Infinity;

  static forGame(game: object): ShipVisualCooldown {
    let cooldown = this.sessions.get(game);
    if (!cooldown) {
      cooldown = new ShipVisualCooldown();
      this.sessions.set(game, cooldown);
    }
    return cooldown;
  }

  remaining(now: number): number {
    return Math.max(0, 2000 - (now - this.lastApplied));
  }

  mark(now: number): void {
    this.lastApplied = now;
  }
}
