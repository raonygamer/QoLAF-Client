import type { Game } from '../game/Game';
import { emitterTargetPose } from './EmitterTargetPose';
import { updateEmitterVisibility } from './EmitterVisibility';
export { emitterTargetPose } from './EmitterTargetPose';
export { emitterCullingRadius, updateEmitterVisibility } from './EmitterVisibility';
import { GameReflection } from '../api/GameReflection';
import {
  Engine,
  EnemyShip,
  GameObject,
  Particle,
  Color as NativeColor,
  CollectiveMeshBatch,
  EmitterFactory,
  Emitter as NativeEmitter,
} from '../game/Bindings';
import { beginEmitterFrame, installEmitterLifecycle } from './EmitterLifecycle';
import { installNativeBeamResources } from '../weapon/NativeBeamResources';
import { installProjectileThrustAnchors } from './ProjectileThrustAnchor';
import { AuraLightningFrames, installAuraLightning } from './AuraLightningFrames';
import { installAuraStyles } from './AuraStyles';
import { AuraPulses, installAuraPulses } from './AuraPulses';
import { installRarityAuraLayers } from './RarityAuraLayers';
import { installEmitterDelays } from './EmitterDelays';
import { EmitterTargets } from './EmitterTargets';
import { installEmitterMirroring } from './EmitterMirroring';
import { type API } from '../api/Types';

/** Original elapsed-time emission/motion rules, adapted to native particle pools. */
interface FrameEmitter extends NativeEmitter {
  retainUntilKilled?: boolean;
  mirrorY?: boolean;
}

export class EmitterFrames {
  private pendingDelta = new WeakMap<Game.core.particle.Particle, number>();
  private emittedCount = new WeakMap<FrameEmitter, number>();
  constructor(
    private Particle: new () => Particle,
    private Emitter: Pick<
      typeof NativeEmitter,
      'POOL_SIZE_MAX' | 'POOL_SIZE_MIN' | 'IS_HIGH_GRAPHICS' | 'setHighGraphics'
    >,
    private Color: Pick<typeof NativeColor, 'interpolateColor'>,
    private targets = new EmitterTargets(),
    private prepareFrame?: (emitter: FrameEmitter) => void,
    private auraPulses?: AuraPulses,
    private lightning?: AuraLightningFrames,
  ) {}

  restart(emitter: FrameEmitter): void {
    emitter.emittAccum = 0;
    this.emittedCount.delete(emitter);
  }

  reset(emitter: FrameEmitter): void {
    this.restart(emitter);
    for (const particle of emitter.particles ?? []) this.pendingDelta.delete(particle);
    for (const particle of emitter.inactiveParticles ?? []) this.pendingDelta.delete(particle);
    this.targets.release(emitter);
  }

  update(emitter: FrameEmitter, milliseconds: number): void {
    this.prepareFrame?.(emitter);
    this.lightning?.begin(emitter);
    if (this.targets.stale(emitter)) {
      emitter.killEmitter();
      this.targets.release(emitter);
      return;
    }
    const delta = Number.isFinite(milliseconds) ? Math.max(0, Math.min(500, milliseconds)) : 0;
    const constant = emitter.get_constantEmitter();
    if (!emitter.isEmitting && !emitter.particles.length && (constant || emitter.retainUntilKilled))
      return;
    emitter.nextDistanceCalculation -= delta;
    if (emitter.nextDistanceCalculation <= 0) {
      this.position(emitter);
      emitter.updateOnScreen();
    } else if (emitter.isOnScreen || emitter.forceUpdate) this.position(emitter);
    if (!emitter.isOnScreen && !emitter.global) {
      emitter.setParticlesInactive();
      this.time(emitter, delta);
      return;
    }
    const end = emitter.timeElapsed + delta;
    const active = emitter.isEmitting
      ? Math.max(
          0,
          Math.min(end, constant ? end : emitter._duration + emitter.delay) -
            Math.max(emitter.timeElapsed, emitter.delay),
        )
      : 0;
    const afterEmission = constant
      ? 0
      : delta -
        Math.max(0, Math.min(delta, emitter._duration + emitter.delay - emitter.timeElapsed));
    if (active > 0) this.emit(emitter, active, afterEmission);
    this.draw(emitter, delta);
    emitter.setBatchParent();
    this.lightning?.finish(emitter, delta);
    this.time(emitter, delta);
  }

  private position(emitter: FrameEmitter): void {
    if (!emitter.followTarget || !emitter.target) return;
    const target = emitter.target,
      pose = emitterTargetPose(target);
    emitter.targetPosX = pose.x;
    emitter.targetPosY = pose.y;
    if (emitter.yOffset !== 0) {
      const radius = Math.abs(emitter.yOffset),
        offset = Math.atan(emitter.yOffset);
      if ((target as Partial<Engine>).ship?.engine === target)
        emitter.angle = pose.rotation + Math.PI;
      emitter.posX = pose.x + Math.cos(emitter.angle + offset) * radius;
      emitter.posY = pose.y + Math.sin(emitter.angle + offset) * radius;
      emitter.angle = pose.rotation + Math.PI;
    } else {
      emitter.posX = pose.x;
      emitter.posY = pose.y;
      emitter.angle = pose.rotation;
    }
  }

  private time(emitter: FrameEmitter, delta: number): void {
    if (emitter.isEmitting) emitter.timeElapsed += delta;
    if (
      !emitter.get_constantEmitter() &&
      emitter.timeElapsed >= emitter._duration + emitter.delay
    ) {
      emitter.isEmitting = false;
      if (!emitter.particles.length && !emitter.retainUntilKilled) emitter.alive = false;
    }
  }

  private emit(emitter: FrameEmitter, delta: number, afterEmission: number): void {
    // Rainbow is a newer native visual: preserve its column creation and 33ms
    // cadence while animating existing particles every render frame.
    const limit = Math.min(emitter.get_maxParticles(), this.Emitter.POOL_SIZE_MAX);
    const rate = emitter.rainbow
      ? 1 / 33
      : !emitter.get_constantEmitter()
        ? emitter.get_ppms()
        : emitter.steadyStream
          ? limit / emitter.ttl
          : 1 / 33;
    if (!(rate > 0)) return;
    emitter.emittAccum += rate * delta;
    const count = Math.floor(emitter.emittAccum + 1e-10);
    emitter.emittAccum = Math.max(0, emitter.emittAccum - count);
    if (!emitter.rainbow) {
      const pool = emitter.inactiveParticles;
      const missing = Math.min(
        count - pool.length,
        this.Emitter.POOL_SIZE_MAX - emitter.particles.length - pool.length,
      );
      for (let index = 0; index < missing; index++) pool.push(new this.Particle());
    }
    let emitted = this.emittedCount.get(emitter) ?? 0;
    for (let index = 1; index <= count; index++) {
      const before = emitter.particles.length;
      if (emitter.rainbow) emitter.addRainbowColumn();
      else if (before < limit) {
        emitter.add(
          emitter.uniformDistribution ? (emitted % Math.max(1, limit)) + 1 : index,
          emitter.uniformDistribution ? Math.max(1, limit) : limit - before,
        );
      }
      const particleDelta =
        afterEmission + Math.min(delta, (count - index + emitter.emittAccum) / rate);
      for (let added = before; added < emitter.particles.length; added++) {
        this.pendingDelta.set(emitter.particles[added], particleDelta);
        emitted++;
      }
    }
    this.emittedCount.set(emitter, emitted);
  }

  private draw(emitter: FrameEmitter, frameDelta: number): void {
    const batch = emitter.collectiveMeshBatch;
    if (!batch) throw Error('Cannot draw an emitter without its collective mesh batch');
    batch.clear();
    let vertices = 0;
    for (let index = emitter.particles.length - 1; index >= 0; index--) {
      const particle = emitter.particles[index];
      const delta = this.pendingDelta.get(particle) ?? frameDelta;
      this.pendingDelta.delete(particle);
      if (particle.ttl - delta <= 0) {
        emitter.remove(particle, index);
        continue;
      }
      const seconds = delta / 1000,
        fraction = particle.ttl / particle.totalTtl;
      const rotation = particle.get_rotation(),
        distance = particle.speed * seconds;
      const pull = Math.pow(Math.max(0, fraction), delta / 33);
      let x: number, y: number;
      if (emitter.followEmitter) {
        if (emitter.centralGravity) {
          particle.localPosX *= pull;
          particle.localPosY *= pull;
        }
        particle.localPosX += Math.cos(rotation) * distance;
        particle.localPosY += Math.sin(rotation) * distance;
        x = particle.localPosX + emitter.posX;
        y = particle.localPosY + emitter.posY;
        particle.set_rotation(emitter.angle);
      } else {
        x = particle.get_x() + Math.cos(rotation) * distance + emitter.gravityX * seconds;
        y = particle.get_y() + Math.sin(rotation) * distance + emitter.gravityY * seconds;
        if (emitter.centralGravity) {
          x = (x - emitter.posX) * pull + emitter.posX;
          y = (y - emitter.posY) * pull + emitter.posY;
        }
      }
      particle.set_x(x);
      particle.set_y(y);
      const size = (particle.startSize - particle.finishSize) * fraction + particle.finishSize;
      particle.set_scaleX(
        emitter.rainbow ? particle.rainbowLength / emitter._txt!.get_width() : size,
      );
      particle.set_scaleY(emitter.mirrorY ? -size : size);
      if (!emitter.rainbow)
        particle.set_color(
          this.Color.interpolateColor(emitter._startColor, emitter._finishColor, 1 - fraction),
        );
      const nativeAlpha =
        (particle.startAlpha - particle.finishAlpha) * fraction + particle.finishAlpha;
      const alpha = this.auraPulses?.apply(emitter, particle, fraction, nativeAlpha) ?? nativeAlpha;
      if (particle.ticks === 0) particle.set_blendMode('add');
      particle.ticks++;
      if (emitter.useFriction) particle.speed *= Math.pow(0.98, delta / 33);
      particle.ttl -= delta;
      if (emitter.isOnScreen) {
        vertices += 4;
        if (vertices >= 2400) {
          this.Emitter.POOL_SIZE_MAX = 10;
          this.Emitter.POOL_SIZE_MIN = 2;
          break;
        }
        if (batch.canAddMesh(particle)) {
          batch.addMesh(particle, null, alpha, null, false);
          this.lightning?.observe(emitter, particle, alpha);
        }
      }
    }
    if (this.Emitter.IS_HIGH_GRAPHICS && vertices < 1200) this.Emitter.setHighGraphics();
  }
}

export function installEmitterFrames(api: API): void {
  const Emitter = NativeEmitter;
  const reflection = new GameReflection(api);
  if (!Emitter || !Particle || !NativeColor || !CollectiveMeshBatch) return;
  installEmitterLifecycle(api);
  // Emitter.diff triples the high-quality pool and matching render thresholds.
  // Hook every graphics-mode reset so the native 100-particle limit cannot return.
  reflection.after(Emitter, 'setHighGraphics', () => {
    Emitter.POOL_SIZE_MAX = 300;
  });
  if (Emitter.IS_HIGH_GRAPHICS) Emitter.setHighGraphics();
  const targets = new EmitterTargets(Engine, EnemyShip);
  installProjectileThrustAnchors(api, emitterTargetPose);
  installEmitterMirroring(api);
  installNativeBeamResources(api);
  const prepareAuras = installRarityAuraLayers(api);
  installAuraStyles(api);
  const pulses = installAuraPulses(api);
  const lightning = installAuraLightning(api);
  const frames = new EmitterFrames(
    Particle,
    Emitter,
    NativeColor,
    targets,
    prepareAuras,
    pulses,
    lightning,
  );
  installEmitterDelays(api, targets);
  // fastForward and other native callers must use the same elapsed-time path
  // as display frames. Calls without a delta retain the source's 33 ms default.
  reflection.around(Emitter.prototype, 'update', function (_next, milliseconds: number = 33) {
    frames.update(this, milliseconds);
  });
  reflection.before(Emitter.prototype, 'play', function () {
    frames.restart(this);
  });
  reflection.before(Emitter.prototype, 'killEmitter', function () {
    frames.reset(this);
  });
  // Unit.reset reaches GameObject.reset; Engine.reset does not call its base.
  for (const prototype of [GameObject.prototype, Engine.prototype]) {
    reflection.before(prototype, 'reset', function () {
      targets.resetTarget(this);
    });
  }
  reflection.after(EmitterFactory, 'create', function (emitters) {
    for (const emitter of emitters ?? []) targets.capture(emitter);
  });
  new GameReflection(api).around(NativeEmitter.prototype, 'updateOnScreen', function () {
    updateEmitterVisibility(this);
  });
  reflection.before(Emitter.prototype, 'dispose', function () {
    frames.reset(this);
    const emitter: FrameEmitter = this;
    emitter.retainUntilKilled = false;
  });
  api.onGame((value, session) => {
    const game = reflection.cast(value, 'core.scene.Game');
    const hooks = new GameReflection(session);
    const manager = game.emitterManager;
    const parallax = game.parallaxManager;
    if (!manager || !parallax) return;
    // The cached Game.update callback reaches parallax once per display frame,
    // after ship drawing. Suppress only this session's old tick-time emitter call.
    hooks.around(manager, 'update', function () {});
    hooks.before(parallax, 'update', function (seconds = 1 / 60) {
      if (game.get_isLeaving() || !manager.emitters) return;
      beginEmitterFrame();
      for (let index = manager.emitters.length - 1; index >= 0; index--) {
        const emitter = manager.emitters[index];
        if (emitter.alive && !targets.stale(emitter)) frames.update(emitter, seconds * 1000);
        else manager.removeEmitter(emitter, index);
      }
      CollectiveMeshBatch.AllMeshesAreUpdated();
    });
  });
}
