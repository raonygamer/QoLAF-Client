import {
  Heading,
  PlayerShip,
  type Message,
  type Player,
  type Projectile,
  type Unit,
  type Weapon,
} from '../game/Bindings';
import type { DiagnosticProjectile } from '../game/ProjectileDiagnostics';
import { TorpedoDebugDetails } from './TorpedoDebugDetails';
import { TorpedoDebugRecording } from './TorpedoDebugRecording';
import { TorpedoDebugSampling, type TorpedoSamplingScene } from './TorpedoDebugSampling';
import {
  matchesDebugTorpedo,
  torpedoDebugWeaponKey,
  torpedoHeadingSnapshot,
  torpedoProjectilePhysics,
  torpedoProjectilePose,
  torpedoWeaponPhysics,
} from './TorpedoDebugSnapshots';
import type { TorpedoDebugFrameClock } from './TorpedoDebugTracker';
import type { TorpedoLogFields } from './TorpedoDebugLog';

export interface TorpedoObserverHost {
  clock(): TorpedoDebugFrameClock;
  scene(): TorpedoSamplingScene;
  playerById(id: string): Player | null;
}

/** Read-only observations. Each boundary isolates diagnostics from native packet handling. */
export class TorpedoDebugObserver {
  constructor(
    private readonly recording: TorpedoDebugRecording,
    private readonly sampling: TorpedoDebugSampling,
    private readonly host: TorpedoObserverHost,
  ) {}

  spawn(
    id: number,
    owner: Unit | null,
    weapon: Weapon | null,
    raw: Heading,
    wireSpeed: number,
  ): void {
    this.observe(() => {
      if (!weapon || weapon.key !== torpedoDebugWeaponKey) return;
      const clock = this.host.clock();
      const entry = this.recording.tracker.spawn(
        id,
        torpedoHeadingSnapshot(raw),
        torpedoWeaponPhysics(
          weapon,
          Number.isFinite(wireSpeed) && wireSpeed !== 0 ? wireSpeed : weapon.speed,
        ),
        clock.localMs,
      );
      const position = owner?.get_pos();
      this.recording.event('spawn_packet', {
        id,
        generation: entry.generation,
        raw: entry.raw,
        physics: entry.physics,
        wireSpeed,
        shooter:
          owner && position
            ? { id: owner.get_id(), name: owner.get_name(), x: position.x, y: position.y }
            : null,
        arrivalAgeMs: clock.serverEstimateMs - raw.time,
      });
    });
  }

  activation(projectile: Projectile): void {
    this.observeProjectile(projectile, () => {
      const entry = this.recording.tracker.ensure(projectile.get_id(), this.host.clock().localMs);
      entry.physics = torpedoProjectilePhysics(projectile);
      const row = this.updateRow(projectile);
      this.recording.event('activated', {
        torpedo: row,
        rawKnown: entry.raw !== null,
        details: TorpedoDebugDetails.projectile(projectile),
      });
    });
  }

  course(projectile: DiagnosticProjectile, message: Message, offset: number, mode: number): void {
    this.observeProjectile(projectile, () => {
      const clock = this.host.clock();
      const entry = this.recording.tracker.ensure(projectile.get_id(), clock.localMs);
      const before = torpedoHeadingSnapshot(projectile.course);
      const containsHeading = mode !== 0 && mode !== 1 && mode !== 2;
      if (containsHeading) {
        const heading = new Heading();
        heading.parseMessage(message, offset + 4);
        const snapshot = torpedoHeadingSnapshot(heading);
        if (snapshot) this.recording.tracker.course(projectile.get_id(), snapshot, clock.localMs);
      }
      entry.physics = torpedoProjectilePhysics(projectile);
      this.recording.event('course_packet', {
        id: projectile.get_id(),
        generation: entry.generation,
        mode,
        argument: message.getInt(offset + 2),
        value: message.getNumber(offset + 3),
        containsHeading,
        raw: entry.raw,
        before,
        correctedMode: projectile.get_usesServerBulletCourse?.() ?? false,
      });
    });
  }

  afterCourse(projectile: Projectile): void {
    this.observeProjectile(projectile, () =>
      this.recording.event('course_applied', { torpedo: this.updateRow(projectile) }),
    );
  }

  contact(projectile: Projectile, target: Unit, alignedContact: TorpedoLogFields | null): void {
    this.observeProjectile(projectile, () => {
      const position = target.get_pos();
      this.recording.event('client_contact', {
        torpedo: this.updateRow(projectile),
        alignedContact,
        details: TorpedoDebugDetails.projectile(projectile),
        segmentStart: { x: projectile.oldPos.x, y: projectile.oldPos.y },
        target:
          target instanceof PlayerShip
            ? this.playerData(target)
            : {
                id: target.get_id(),
                name: target.get_name(),
                x: position.x,
                y: position.y,
                radius: target.collisionRadius,
              },
        note:
          alignedContact === null
            ? 'Client collision test before contact solver. Not confirmation of server damage.'
            : 'Aligned client collision estimate before visual removal. Not confirmation of server damage.',
      });
      this.recording.requestHistory('client_contact');
    });
  }

  removal(projectile: Projectile, kind: string): void {
    this.observeProjectile(projectile, () => {
      const position = projectile.get_pos();
      this.recording.event(kind, {
        torpedo: this.updateRow(projectile),
        playersAtReceipt: this.nearbyPlayers(position.x, position.y),
        details: TorpedoDebugDetails.projectile(projectile),
        note: 'Local solved course is not an authoritative impact point. Server kill messages contain only IDs.',
      });
    });
  }

  serverRemoval(id: number): void {
    this.observe(() => {
      const shot = this.host.scene().projectileById(id);
      if (matchesDebugTorpedo(shot)) {
        this.removal(shot, 'server_kill_received');
        return;
      }
      const entry = this.recording.tracker.get(id);
      if (!entry) return;
      this.recording.event('server_kill_received', {
        id,
        torpedo: entry.row,
        noLiveTrackedTorpedo: true,
        idCurrentlyReused: shot !== null,
        lastSnapshotAgeMs: (this.host.clock().localMs - entry.lastSeen) >>> 0,
        note: 'Server ID removal after local disappearance. Stored pose is stale; no authoritative impact position or generation is supplied.',
      });
    });
  }

  playerCourse(player: Player | null, raw: Heading | null, kind: string): void {
    this.observe(() => {
      if (!player) return;
      const clock = this.host.clock();
      const receipt = this.sampling.playerSnapshots.observe(player.id, raw, clock.localMs);
      this.recording.event(kind, {
        playerId: player.id,
        raw: receipt.raw,
        arrivalAgeMs: raw ? clock.serverEstimateMs - raw.time : NaN,
        details: TorpedoDebugDetails.player(player.ship),
        client: player.ship ? this.playerData(player.ship) : null,
      });
    });
  }

  damage(player: Player | null, message: Message, offset: number): void {
    this.observe(() => {
      if (!player?.ship) return;
      const victim = this.playerData(player.ship);
      const candidates = this.sampling.candidates(this.host.scene(), this.host.clock(), victim);
      const hasDebuff = message.getBoolean(offset + 5);
      this.recording.event('player_damage_unattributed', {
        victim,
        details: TorpedoDebugDetails.player(player.ship),
        reportedDamage1: message.getInt(offset + 1),
        reportedDamage2: message.getInt(offset + 2),
        shieldAfter: message.getInt(offset + 3),
        hpAfter: message.getInt(offset + 4),
        hasDebuff,
        candidates,
        debuff:
          hasDebuff && message.length > offset + 9
            ? {
                durationSeconds: message.getNumber(offset + 6),
                effectKey: message.getString(offset + 7),
                debuffType: message.getInt(offset + 8),
                displayText: message.getString(offset + 9),
              }
            : null,
        note: 'Nearby candidates only. This packet does not identify the attacking projectile or impact position.',
      });
      if (candidates.length) this.recording.requestHistory('damage');
    });
  }

  death(message: Message): void {
    this.observe(() => {
      if (message.length < 1) return;
      const id = message.getString(0);
      const player = this.host.playerById(id);
      const victim = player?.ship ? this.playerData(player.ship) : null;
      this.recording.event('player_killed_packet', {
        victimId: id,
        victim,
        killerName: message.length > 1 ? message.getString(1).slice(0, 256) : null,
        cause: message.length > 2 ? message.getString(2).slice(0, 256) : null,
        lostXP: message.length > 3 ? String(message.getNumber(3)).slice(0, 64) : null,
        damageType: message.length > 4 ? message.getInt(4) : null,
        packetLength: message.length,
        trailingDropFields: Math.max(0, message.length - 5),
        details: player ? TorpedoDebugDetails.player(player.ship) : null,
        candidates: this.sampling.candidates(this.host.scene(), this.host.clock(), victim),
        playersAtReceipt: victim ? this.nearbyPlayers(victim.x, victim.y) : [],
        note: 'Fatal header as received. Killer/cause is reported; projectile attribution, impact position and server impact time are NOT in this packet. Snapshot is before cleanup; HP/shield may still be pre-hit.',
      });
      this.recording.scheduleDeathSave();
    });
  }

  private playerData(ship: PlayerShip) {
    const clock = this.host.clock();
    return this.sampling.playerSnapshots.snapshot(
      ship,
      clock.serverEstimateMs,
      clock.localMs,
      clock.frameAlpha,
    );
  }

  private nearbyPlayers(x: number, y: number) {
    const clock = this.host.clock();
    return this.sampling.playerSnapshots.nearby(
      this.host.scene().players,
      x,
      y,
      clock.serverEstimateMs,
      clock.localMs,
      clock.frameAlpha,
    );
  }

  private updateRow(projectile: Projectile) {
    return this.recording.tracker.updateRow(torpedoProjectilePose(projectile), this.host.clock());
  }

  private observeProjectile(projectile: Projectile, operation: () => void): void {
    this.observe(() => {
      if (matchesDebugTorpedo(projectile)) operation();
    });
  }

  private observe(operation: () => void): void {
    if (!this.recording.active) return;
    try {
      operation();
    } catch (error) {
      this.recording.observerFailed(error);
    }
  }
}
