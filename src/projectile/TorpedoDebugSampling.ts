import type { PlayerShip, Projectile } from '../game/Bindings';
import type { TorpedoDebugFrameClock } from './TorpedoDebugTracker';
import { TorpedoDebugTracker } from './TorpedoDebugTracker';
import type { TorpedoTickProjectile, TorpedoTickSnapshot } from './TorpedoDebugHistory';
import {
  matchesDebugTorpedo,
  torpedoPlayerTick,
  torpedoProjectilePhysics,
  torpedoProjectilePose,
  TorpedoDebugPlayerSnapshots,
  type TorpedoDebugPlayerSnapshot,
} from './TorpedoDebugSnapshots';

export interface TorpedoSamplingScene {
  projectiles: readonly Projectile[];
  players: readonly PlayerShip[];
  projectileById(id: number): Projectile | null;
  playerShipById(id: string): PlayerShip | null;
}

/** Source selection limits; selected poses still refresh on every display frame. */
export class TorpedoDebugSampling {
  private lastSample = 0;
  private visibleIds: number[] = [];
  private playerIds: string[] = [];

  constructor(
    readonly tracker: TorpedoDebugTracker,
    readonly playerSnapshots: TorpedoDebugPlayerSnapshots,
  ) {}

  frame(
    scene: TorpedoSamplingScene,
    clock: TorpedoDebugFrameClock,
    centerX: number,
    centerY: number,
  ) {
    const localMs = clock.localMs >>> 0;
    const sample = (localMs - this.lastSample) >>> 0 >= 100;
    if (sample) {
      this.lastSample = localMs;
      const visible: { id: number; distance: number }[] = [];
      for (const projectile of scene.projectiles) {
        if (!projectile.alive || !matchesDebugTorpedo(projectile)) continue;
        this.prepare(projectile, localMs);
        const position = projectile.get_pos();
        const dx = position.x - centerX;
        const dy = position.y - centerY;
        const distance = dx * dx + dy * dy;
        this.tracker.ensure(projectile.get_id(), localMs).distance = distance;
        visible.push({ id: projectile.get_id(), distance });
      }
      visible.sort((left, right) => left.distance - right.distance);
      this.visibleIds = visible.slice(0, 12).map((entry) => entry.id);
      this.playerIds = this.playerSnapshots
        .nearby(scene.players, centerX, centerY, clock.serverEstimateMs, localMs, clock.frameAlpha)
        .map((entry) => entry.id);
    }
    const players: TorpedoDebugPlayerSnapshot[] = [];
    this.playerIds = this.playerIds.filter((id) => {
      const ship = scene.playerShipById(id);
      if (!ship?.alive) return false;
      players.push(
        this.playerSnapshots.snapshot(ship, clock.serverEstimateMs, localMs, clock.frameAlpha),
      );
      return true;
    });
    const torpedoes = [];
    for (const id of this.visibleIds) {
      const projectile = scene.projectileById(id);
      if (!projectile?.alive || !matchesDebugTorpedo(projectile)) continue;
      const entry = this.tracker.ensure(id, localMs);
      if (projectile.isAddedToCanvas) entry.lastDrawnAt = localMs;
      torpedoes.push(this.tracker.updateRow(torpedoProjectilePose(projectile), clock));
    }
    return {
      sample,
      torpedoes,
      players,
      selected: torpedoes.length,
      tracked: this.tracker.size,
      frameAlpha: clock.frameAlpha,
    };
  }

  tick(
    scene: TorpedoSamplingScene,
    clock: TorpedoDebugFrameClock,
    centerX: number,
    centerY: number,
    simulationMs: number,
    oneWayLatencyMs: number,
  ): TorpedoTickSnapshot {
    const nearby = this.playerSnapshots.nearby(
      scene.players,
      centerX,
      centerY,
      clock.serverEstimateMs,
      clock.localMs,
      clock.frameAlpha,
    );
    const players = nearby.flatMap((snapshot) => {
      const row = torpedoPlayerTick(snapshot);
      return row ? [row] : [];
    });
    const shots: { distance: number; row: TorpedoTickProjectile }[] = [];
    for (const projectile of scene.projectiles) {
      if (!projectile.alive || !matchesDebugTorpedo(projectile)) continue;
      const position = projectile.get_pos();
      let distance = Infinity;
      for (const player of nearby) {
        const dx = position.x - player.x;
        const dy = position.y - player.y;
        distance = Math.min(distance, dx * dx + dy * dy);
      }
      if (distance > 1440000) continue;
      const entry = this.tracker.ensure(projectile.get_id(), clock.localMs);
      const pose = torpedoProjectilePose(projectile);
      shots.push({
        distance,
        row: [
          pose.id,
          entry.generation,
          pose.x,
          pose.y,
          pose.vx,
          pose.vy,
          pose.courseTime,
          pose.rotation,
          pose.radius,
          pose.oldX,
          pose.oldY,
          pose.renderX,
          pose.renderY,
          pose.ttl,
          pose.shooterId,
        ],
      });
    }
    shots.sort((left, right) => left.distance - right.distance);
    return {
      localMs: clock.localMs >>> 0,
      serverEstimateMs: clock.serverEstimateMs,
      simulationMs,
      frameAlpha: clock.frameAlpha,
      oneWayLatencyMs,
      players,
      torpedoes: shots.slice(0, 24).map((shot) => shot.row),
      omittedTorpedoes: Math.max(0, shots.length - 24),
    };
  }

  candidates(
    scene: TorpedoSamplingScene,
    clock: TorpedoDebugFrameClock,
    victim: TorpedoDebugPlayerSnapshot | null,
  ) {
    if (!victim) return [];
    for (const projectile of scene.projectiles) {
      if (!projectile.alive || !matchesDebugTorpedo(projectile)) continue;
      const position = projectile.get_pos();
      const dx = position.x - victim.x;
      const dy = position.y - victim.y;
      if (dx * dx + dy * dy > 4000000) continue;
      this.prepare(projectile, clock.localMs);
      this.tracker.updateRow(torpedoProjectilePose(projectile), clock);
    }
    const candidates = [];
    for (const entry of this.tracker.values()) {
      const row = entry.row;
      const sampleAgeMs = (clock.localMs - entry.lastSeen) >>> 0;
      if (!row || sampleAgeMs > 5000) continue;
      const dx = row.renderX - victim.renderX;
      const dy = row.renderY - victim.renderY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (!Number.isFinite(distance) || distance > 2000) continue;
      candidates.push({
        id: row.id,
        generation: entry.generation,
        distance,
        clientClearance: distance - row.radius - victim.radius,
        sampleAgeMs,
        torpedo: row,
      });
    }
    candidates.sort((left, right) => left.distance - right.distance);
    return candidates.slice(0, 8);
  }

  private prepare(projectile: Projectile, localMs: number): void {
    const entry = this.tracker.ensure(projectile.get_id(), localMs);
    if (!entry.physics) entry.physics = torpedoProjectilePhysics(projectile);
  }

  markerEntries() {
    return this.visibleIds.flatMap((id) => {
      const entry = this.tracker.get(id);
      return entry ? [entry] : [];
    });
  }

  reset(): void {
    this.lastSample = 0;
    this.visibleIds = [];
    this.playerIds = [];
    this.playerSnapshots.reset();
  }
}
