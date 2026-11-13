/** Immutable source selection context: clock bucket and event fields, never local RNG. */
export class DeathMessageSelection {
  static readonly bucketMs = 10000;
  private readonly eventHash: number;

  constructor(
    serverTime: number,
    roomId: string | null,
    victimId: string | null,
    killerName: string | null,
    cause: string | null,
  ) {
    const bucket =
      Number.isFinite(serverTime) && serverTime >= 0 && serverTime <= Number.MAX_SAFE_INTEGER
        ? Math.floor(serverTime / DeathMessageSelection.bucketMs)
        : 0;
    let hash = 0x811c9dc5;
    for (const field of ['qolaf.death.v1', String(bucket), roomId, victimId, killerName, cause])
      hash = DeathMessageSelection.appendField(hash, field);
    this.eventHash = hash;
  }

  index(poolId: string, count: number): number {
    if (count <= 0) return -1;
    let hash = DeathMessageSelection.appendField(this.eventHash, poolId);
    hash = (hash + (hash << 13)) >>> 0;
    hash = (hash ^ (hash >>> 7)) >>> 0;
    hash = (hash + (hash << 3)) >>> 0;
    hash = (hash ^ (hash >>> 17)) >>> 0;
    hash = (hash + (hash << 5)) >>> 0;
    return hash % count;
  }

  private static appendField(hash: number, value: string | null): number {
    value ??= '';
    const length = value.length;
    for (let shift = 0; shift < 32; shift += 8)
      hash = this.appendByte(hash, (length >>> shift) & 255);
    for (let index = 0; index < length; index++) {
      const code = value.charCodeAt(index);
      hash = this.appendByte(hash, code & 255);
      hash = this.appendByte(hash, code >>> 8);
    }
    return hash;
  }

  private static appendByte(hash: number, value: number): number {
    hash ^= value;
    return (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
}
