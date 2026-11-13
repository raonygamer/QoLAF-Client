export interface TorpedoTimingRow {
  index: number;
  ownerId: number;
  spawnElapsedMs: number;
  arrivalElapsedMs: number;
  spawnGapMs: number;
  arrivalGapMs: number;
  gapChangeMs: number;
  arrivalJitterMs: number;
  arrivalDriftMs: number;
  outOfOrder: boolean;
}

interface OwnerTiming {
  spawnTime: number;
  arrivalElapsed: number;
  positiveGap: number;
}

/** Original exact-volley deduplication and per-shooter cadence measurements. */
export class TorpedoSpawnTiming {
  private recent: { ownerId: number; spawnTime: number }[] = [];
  private owners = new Map<number, OwnerTiming>();
  private anchored = false;
  private spawnAnchor = 0;
  private lastReceivedAt = 0;
  private arrivalElapsed = 0;
  private observedIndex = 0;

  reset(): void {
    this.recent = [];
    this.owners.clear();
    this.anchored = false;
    this.spawnAnchor = this.lastReceivedAt = this.arrivalElapsed = this.observedIndex = 0;
  }

  observe(ownerId: number, spawnTime: number, receivedAt: number): TorpedoTimingRow | null {
    if (!Number.isFinite(spawnTime) || spawnTime < 0 || spawnTime > 1e15) return null;
    receivedAt >>>= 0;
    if (this.anchored) {
      // Duplicate siblings still advance the unsigned, wrap-aware arrival clock.
      this.arrivalElapsed += (receivedAt - this.lastReceivedAt) >>> 0;
      this.lastReceivedAt = receivedAt;
    }
    if (this.recent.some((seen) => seen.ownerId === ownerId && seen.spawnTime === spawnTime))
      return null;
    if (this.recent.length >= 256) this.recent.shift();
    this.recent.push({ ownerId, spawnTime });
    if (!this.anchored) {
      this.anchored = true;
      this.spawnAnchor = spawnTime;
      this.lastReceivedAt = receivedAt;
    }
    const previous = this.owners.get(ownerId);
    const spawnElapsed = spawnTime - this.spawnAnchor;
    const spawnGap = previous ? spawnTime - previous.spawnTime : NaN;
    const arrivalGap = previous ? this.arrivalElapsed - previous.arrivalElapsed : NaN;
    const late = spawnElapsed < 0 || (!!previous && spawnTime <= previous.spawnTime);
    const row: TorpedoTimingRow = {
      index: ++this.observedIndex,
      ownerId,
      spawnElapsedMs: spawnElapsed,
      arrivalElapsedMs: this.arrivalElapsed,
      spawnGapMs: spawnGap,
      arrivalGapMs: arrivalGap,
      gapChangeMs: previous ? spawnGap - previous.positiveGap : NaN,
      arrivalJitterMs: arrivalGap - spawnGap,
      arrivalDriftMs: this.arrivalElapsed - spawnElapsed,
      outOfOrder: late,
    };
    if (!late) {
      if (!previous && this.owners.size >= 64) {
        const oldest = this.owners.keys().next();
        if (!oldest.done) this.owners.delete(oldest.value);
      }
      this.owners.delete(ownerId);
      this.owners.set(ownerId, {
        spawnTime,
        arrivalElapsed: this.arrivalElapsed,
        positiveGap: spawnGap > 0 ? spawnGap : (previous?.positiveGap ?? NaN),
      });
    }
    return row;
  }
}
