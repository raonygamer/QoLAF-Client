import {
  TorpedoDebugProjection,
  type TorpedoDebugHeading,
  type TorpedoDebugPhysics,
} from './TorpedoDebugProjection';

export type TorpedoDebugPose = {
  id: number;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  vx: number;
  vy: number;
  courseTime: number;
  rotation: number;
  radius: number;
  ttl: number;
  alive: boolean;
  visible: boolean;
  onCanvas: boolean;
  corrected: boolean;
  errorX: number;
  errorY: number;
  convergenceCounter: number;
  convergenceTime: number;
  oldX: number;
  oldY: number;
  shooterId: number;
  renderedCourseTime: number;
};

export type TorpedoDebugFrameClock = {
  localMs: number;
  serverEstimateMs: number;
  projectileRenderTime: number;
  frameAlpha: number;
};

export type TorpedoDebugRow = TorpedoDebugPose & {
  generation: number;
  corrections: number;
  raw: Readonly<TorpedoDebugHeading> | null;
  rawSource: 'spawn' | 'course' | null;
  physics: Readonly<TorpedoDebugPhysics> | null;
  drawObserved: boolean;
  lastDrawAgeMs: number;
  rawX: number;
  rawY: number;
  rawTime: number;
  ageMs: number;
  receiptAgeMs: number;
  projectionTimeMs: number;
  projectionValid: boolean;
  projectionReason: string;
  projectedX: number;
  projectedY: number;
  correctionX: number;
  correctionY: number;
  gapX: number;
  gapY: number;
  timelineOffsetMs: number;
  frameAlpha: number;
};

export type TorpedoDebugEntry = {
  distance?: number;
  readonly id: number;
  generation: number;
  raw: Readonly<TorpedoDebugHeading> | null;
  rawSource: 'spawn' | 'course' | null;
  physics: Readonly<TorpedoDebugPhysics> | null;
  model: Readonly<TorpedoDebugHeading> | null;
  corrections: number;
  lastSeen: number;
  receivedAt: number | null;
  lastDrawnAt: number | null;
  row: TorpedoDebugRow | null;
};

/** Detached recorder state. No live heading, sprite or projectile is retained. */
export class TorpedoDebugTracker {
  private readonly entries = new Map<number, TorpedoDebugEntry>();
  private serial = 0;

  constructor(private readonly onTrackingLimit: (removedId: number) => void) {}

  get size(): number {
    return this.entries.size;
  }

  values(): IterableIterator<TorpedoDebugEntry> {
    return this.entries.values();
  }

  get(id: number): TorpedoDebugEntry | undefined {
    return this.entries.get(id);
  }

  ensure(id: number, localMs: number): TorpedoDebugEntry {
    const existing = this.entries.get(id);
    if (existing) return existing;
    if (this.entries.size >= 256) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.onTrackingLimit(oldest.value);
        this.entries.delete(oldest.value);
      }
    }
    const entry: TorpedoDebugEntry = {
      id,
      generation: ++this.serial,
      raw: null,
      rawSource: null,
      physics: null,
      model: null,
      corrections: 0,
      lastSeen: localMs >>> 0,
      receivedAt: null,
      lastDrawnAt: null,
      row: null,
    };
    this.entries.set(id, entry);
    return entry;
  }

  spawn(
    id: number,
    raw: Readonly<TorpedoDebugHeading> | null,
    physics: Readonly<TorpedoDebugPhysics>,
    localMs: number,
  ): TorpedoDebugEntry {
    const entry = this.ensure(id, localMs);
    // The original increments on both first tracking and each received spawn.
    entry.generation = ++this.serial;
    entry.row = null;
    entry.model = null;
    entry.lastDrawnAt = null;
    entry.raw = raw ? { ...raw } : null;
    entry.rawSource = 'spawn';
    entry.receivedAt = localMs >>> 0;
    entry.corrections = 0;
    entry.physics = { ...physics };
    return entry;
  }

  course(id: number, raw: Readonly<TorpedoDebugHeading>, localMs: number): TorpedoDebugEntry {
    const entry = this.ensure(id, localMs);
    entry.raw = { ...raw };
    entry.rawSource = 'course';
    entry.model = null;
    entry.receivedAt = localMs >>> 0;
    entry.corrections++;
    return entry;
  }

  updateRow(
    pose: Readonly<TorpedoDebugPose>,
    clock: Readonly<TorpedoDebugFrameClock>,
  ): TorpedoDebugRow {
    const entry = this.ensure(pose.id, clock.localMs);
    const projectionTimeMs = Number.isFinite(clock.projectileRenderTime)
      ? clock.projectileRenderTime
      : clock.serverEstimateMs;
    const projected = this.project(entry, projectionTimeMs);
    const projectionValid = projected?.valid ?? false;
    const projectedX = projectionValid && projected ? projected.x : NaN;
    const projectedY = projectionValid && projected ? projected.y : NaN;
    const gapX = pose.renderX - projectedX;
    const gapY = pose.renderY - projectedY;
    const rawTime = entry.raw?.time ?? NaN;
    const row: TorpedoDebugRow = {
      ...pose,
      generation: entry.generation,
      corrections: entry.corrections,
      raw: entry.raw,
      rawSource: entry.rawSource,
      physics: entry.physics,
      drawObserved: entry.lastDrawnAt !== null,
      lastDrawAgeMs: entry.lastDrawnAt === null ? NaN : (clock.localMs - entry.lastDrawnAt) >>> 0,
      rawX: entry.raw?.x ?? NaN,
      rawY: entry.raw?.y ?? NaN,
      rawTime,
      ageMs: clock.serverEstimateMs - rawTime,
      receiptAgeMs: entry.receivedAt === null ? NaN : (clock.localMs - entry.receivedAt) >>> 0,
      projectionTimeMs,
      projectionValid,
      projectionReason: projected?.reason ?? 'no raw packet captured',
      projectedX,
      projectedY,
      // Historical names describe a visual gap, not a received server correction.
      correctionX: gapX,
      correctionY: gapY,
      gapX,
      gapY,
      timelineOffsetMs:
        (Number.isFinite(pose.renderedCourseTime)
          ? pose.renderedCourseTime
          : pose.courseTime + 33 * clock.frameAlpha) - projectionTimeMs,
      frameAlpha: clock.frameAlpha,
    };
    entry.row = row;
    entry.lastSeen = clock.localMs >>> 0;
    return row;
  }

  private project(
    entry: TorpedoDebugEntry,
    now: number,
  ): { valid: boolean; reason: string; x: number; y: number } | null {
    if (!entry.raw || !entry.physics) return null;
    if (!Number.isFinite(now) || now < entry.raw.time || now - entry.raw.time > 20000)
      return {
        valid: false,
        reason: 'snapshot outside 20-second projection window',
        x: NaN,
        y: NaN,
      };
    const model = entry.model;
    if (model && now >= model.time - 33 && now < model.time)
      return {
        valid: true,
        reason: '',
        x: model.x + model.vx * (now - model.time) * 0.001,
        y: model.y + model.vy * (now - model.time) * 0.001,
      };
    const base = model && now >= model.time ? model : entry.raw;
    const result = TorpedoDebugProjection.project(base, entry.physics, now);
    if (result.valid)
      entry.model = {
        time: result.time,
        x: result.x + result.vx * (result.time - now) * 0.001,
        y: result.y + result.vy * (result.time - now) * 0.001,
        vx: result.vx,
        vy: result.vy,
        rotation: entry.raw.rotation,
      };
    return result;
  }

  reset(): void {
    this.entries.clear();
    this.serial = 0;
  }
}
