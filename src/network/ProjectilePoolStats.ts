/** Count distinct allocations separately from repeated pool checkouts. */
export class ProjectilePoolStats {
  private readonly seen = new WeakSet<object>();
  created = 0;
  checkouts = 0;

  observe(projectiles: readonly object[]): void {
    for (const projectile of projectiles) {
      if (this.seen.has(projectile)) continue;
      this.seen.add(projectile);
      this.created++;
    }
  }

  checkout(projectile: object): void {
    this.observe([projectile]);
    this.checkouts++;
  }
}

// Original counters persist across room managers for the client lifetime.
export const projectilePoolStats = new ProjectilePoolStats();
