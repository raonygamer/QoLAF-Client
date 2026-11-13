import type { TorpedoLogFields } from './TorpedoDebugLog';

export type TorpedoTickPlayer = readonly [
  id: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
  courseTime: number,
  rotation: number,
  radius: number,
  hp: number,
  shield: number,
  renderX: number,
  renderY: number,
  invulnerable: boolean,
  accelerate: boolean,
  deaccelerate: boolean,
  rotateLeft: boolean,
  rotateRight: boolean,
];
export type TorpedoTickProjectile = readonly [
  id: number,
  generation: number,
  x: number,
  y: number,
  vx: number,
  vy: number,
  courseTime: number,
  rotation: number,
  radius: number,
  oldX: number,
  oldY: number,
  renderX: number,
  renderY: number,
  ttl: number,
  shooterId: number,
];
export type TorpedoTickSnapshot = {
  localMs: number;
  serverEstimateMs: number;
  simulationMs: number;
  frameAlpha: number;
  oneWayLatencyMs: number;
  players: readonly TorpedoTickPlayer[];
  torpedoes: readonly TorpedoTickProjectile[];
  omittedTorpedoes: number;
};
/** JSON replaces non-finite numeric observations with null. */
type SerializedSnapshot<T> = T extends number
  ? number | null
  : T extends object
    ? { [K in keyof T]: SerializedSnapshot<T[K]> }
    : T;
export type SerializedTorpedoTick = SerializedSnapshot<TorpedoTickSnapshot>;

export interface TorpedoHistoryClock {
  sequence: number;
  localMs: number;
  serverEstimateMs: number;
  simulationMs: number;
}
interface Sample {
  readonly id: number;
  readonly time: number;
  readonly line: string;
}
interface Request {
  reason: string;
  requestedAfterSequence: number;
  requestedLocalMs: number;
  requestedServerEstimateMs: number;
  requestedSimulationMs: number;
  ticks: number;
}
interface PendingSample {
  sample: Sample;
  request: Request;
}
export interface TorpedoHistoryHost {
  available(): boolean;
  dirty(): void;
  event(kind: string, data: TorpedoLogFields): void;
  failed(error: unknown): void;
}

/** Immutable tick ring with the original deduplicated, deferred export queue. */
export class TorpedoDebugHistory {
  private samples: Sample[] = [];
  private historyChars = 0;
  private serial = 0;
  private lastQueued = 0;
  private pending: PendingSample[] = [];
  private pendingChars = 0;
  private pendingDropped = 0;
  private totalDropped = 0;
  private lastRequest: Request | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  constructor(private host: TorpedoHistoryHost) {}

  recordTick(snapshot: TorpedoTickSnapshot): void {
    if (!this.host.available()) return;
    const now = snapshot.localMs >>> 0;
    if (snapshot.torpedoes.length) {
      const line = JSON.stringify({ ...snapshot, localMs: now });
      if (line.length <= 16000) {
        this.samples.push({ id: ++this.serial, time: now, line });
        this.historyChars += line.length;
      }
    }
    while (
      this.samples.length &&
      (this.samples.length > 160 ||
        this.historyChars > 512 * 1024 ||
        (now - this.samples[0].time) >>> 0 > 5500)
    ) {
      const removed = this.samples.shift();
      if (removed) this.historyChars -= removed.line.length;
    }
  }

  request(reason: string, clock: TorpedoHistoryClock): void {
    if (
      !this.host.available() ||
      !this.samples.length ||
      this.samples[this.samples.length - 1].id <= this.lastQueued
    )
      return;
    const request: Request = {
      reason,
      requestedAfterSequence: clock.sequence,
      requestedLocalMs: clock.localMs >>> 0,
      requestedServerEstimateMs: clock.serverEstimateMs,
      requestedSimulationMs: clock.simulationMs,
      ticks: 0,
    };
    // Collision callbacks only queue references to serialized, immutable samples.
    for (const sample of this.samples) {
      if (sample.id <= this.lastQueued) continue;
      this.pending.push({ sample, request });
      this.pendingChars += sample.line.length;
      this.lastQueued = sample.id;
      request.ticks++;
    }
    while (this.pending.length > 160 || this.pendingChars > 512 * 1024) {
      const removed = this.pending.shift();
      if (!removed) break;
      this.pendingChars -= removed.sample.line.length;
      this.pendingDropped++;
      this.totalDropped++;
    }
    if (!request.ticks) return;
    this.host.dirty();
    this.scheduleDrain();
  }

  flush(reason: string, clock: TorpedoHistoryClock): void {
    this.request(reason, clock);
    this.drainForSave();
  }

  drainForSave(): void {
    this.cancelDrain();
    this.drain(160);
  }

  private scheduleDrain(): void {
    if (this.timer !== undefined || !this.pending.length || !this.host.available()) return;
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.timer = undefined;
      try {
        this.drain(4);
        this.scheduleDrain();
      } catch (error) {
        this.host.failed(error);
      }
    }, 1);
  }

  private drain(limit: number): void {
    if (!this.host.available()) return;
    if (this.pendingDropped) {
      this.host.event('tick_history_dropped', {
        dropped: this.pendingDropped,
        totalDropped: this.totalDropped,
        note: 'Pending history queue overflow; newest samples retained. Main log also reports its own loss counts.',
      });
      this.pendingDropped = 0;
    }
    for (let count = 0; this.pending.length && count < limit; count++) {
      const queued = this.pending.shift();
      if (!queued) break;
      this.pendingChars -= queued.sample.line.length;
      const request = queued.request;
      if (request !== this.lastRequest) {
        this.host.event('tick_history_begin', {
          ...request,
          note: 'Deduplicated deferred history. Sample clocks are original; record clocks are export time. Post-projectile simulation step; render coordinates are the last DRAWN pose, not the tick pose. No authoritative server collision is inferred.',
        });
        this.lastRequest = request;
      }
      // The string is produced exclusively by recordTick from a typed snapshot;
      // parsing happens here, never in the collision callback.
      const sample = JSON.parse(queued.sample.line) as SerializedTorpedoTick;
      this.host.event('tick_history', {
        reason: request.reason,
        tickId: queued.sample.id,
        requestedAfterSequence: request.requestedAfterSequence,
        requestedLocalMs: request.requestedLocalMs,
        sample,
      });
    }
    if (!this.pending.length) this.lastRequest = null;
  }

  private cancelDrain(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.generation++;
  }

  reset(): void {
    this.cancelDrain();
    this.samples = [];
    this.pending = [];
    this.historyChars = this.serial = this.lastQueued = this.pendingChars = 0;
    this.pendingDropped = this.totalDropped = 0;
    this.lastRequest = null;
  }
}
