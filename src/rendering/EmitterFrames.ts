import { EmitterTargets } from './EmitterTargets';
import { read, type API, type Raw } from '../api/Types';

/** Render-only mount lookup; never writes ship/engine course or simulation position. */
export function emitterTargetPose(target: Raw): { x: number; y: number; rotation: number } {
  const ship = target.ship;
  if (ship?.alive && target.alive && ship.engine === target && ship.enginePos) {
    const pose = emitterTargetPose(ship);
    const mount = ship.enginePos;
    const radius = Math.hypot(mount.x, mount.y);
    const offset = mount.x !== 0 ? Math.atan(mount.y / mount.x) : 0;
    const rotation = pose.rotation + Math.PI;
    return {
      x: pose.x + Math.cos(rotation + offset) * radius,
      y: pose.y + Math.sin(rotation + offset) * radius,
      rotation,
    };
  }
  const clip = target.isAddedToCanvas ? target._mc : null;
  const position = read(target, 'pos');
  return {
    x: read(clip, 'x', position?.x ?? 0),
    y: read(clip, 'y', position?.y ?? 0),
    rotation: read(clip, 'rotation', read(target, 'rotation', 0)),
  };
}

/** Emitter.as includes the authored particle footprint and travel in culling. */
export function emitterCullingRadius(emitter: Raw): number {
  const spread = Math.max(Math.abs(emitter.sourceVarianceX), Math.abs(emitter.sourceVarianceY));
  const travel = (Math.abs(emitter.speed) * (emitter.ttl + Math.abs(emitter.ttlVariance))) / 1000;
  return Math.max(100, read(emitter, 'radius') + spread + travel);
}

export function updateEmitterVisibility(emitter: Raw): void {
  emitter.forceUpdate = false;
  emitter.isOnScreen = emitter.canvasTarget != null;
  if (!emitter.isOnScreen) {
    emitter.isOnScreen = emitter.g.camera.isCircleOnScreen(
      emitter.posX,
      emitter.posY,
      emitterCullingRadius(emitter),
    );
  }
  if (emitter.isOnScreen) {
    emitter.nextDistanceCalculation = 1000;
    return;
  }
  const center = emitter.g.camera.getCameraCenter();
  emitter.distanceToCameraX = emitter.posX - center.x;
  emitter.distanceToCameraY = emitter.posY - center.y;
  emitter.distanceToCamera = Math.hypot(emitter.distanceToCameraX, emitter.distanceToCameraY);
  emitter.nextDistanceCalculation = emitter.distanceToCamera;
  if (emitter.nextDistanceCalculation > emitter.MAX_CALC_DELAY) {
    emitter.nextDistanceCalculation = emitter.MAX_CALC_DELAY + Math.random() * 200;
  }
}

/** Original elapsed-time emission/motion rules, adapted to native particle pools. */
export class EmitterFrames {
  private pendingDelta = new WeakMap<Raw, number>();
  private emittedCount = new WeakMap<Raw, number>();
  constructor(
    private Particle: any,
    private Emitter: Raw,
    private Color: Raw,
    private targets = new EmitterTargets(),
  ) {}

  reset(emitter: Raw): void {
    this.emittedCount.delete(emitter);
    this.targets.release(emitter);
  }

  update(emitter: Raw, milliseconds: number): void {
    if (this.targets.stale(emitter)) {
      emitter.killEmitter();
      this.targets.release(emitter);
      return;
    }
    const delta = Number.isFinite(milliseconds) ? Math.max(0, Math.min(500, milliseconds)) : 0;
    const constant = read(emitter, 'constantEmitter');
    if (!emitter.isEmitting && !emitter.particles.length && constant) return;
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
    this.time(emitter, delta);
  }

  private position(emitter: Raw): void {
    if (!emitter.followTarget || !emitter.target) return;
    const target = emitter.target,
      pose = emitterTargetPose(target);
    emitter.targetPosX = pose.x;
    emitter.targetPosY = pose.y;
    if (emitter.yOffset !== 0) {
      const radius = Math.abs(emitter.yOffset),
        offset = Math.atan(emitter.yOffset);
      if (target.ship?.engine === target) emitter.angle = pose.rotation + Math.PI;
      emitter.posX = pose.x + Math.cos(emitter.angle + offset) * radius;
      emitter.posY = pose.y + Math.sin(emitter.angle + offset) * radius;
      emitter.angle = pose.rotation + Math.PI;
    } else {
      emitter.posX = pose.x;
      emitter.posY = pose.y;
      emitter.angle = pose.rotation;
    }
  }

  private time(emitter: Raw, delta: number): void {
    if (emitter.isEmitting) emitter.timeElapsed += delta;
    if (
      !read(emitter, 'constantEmitter') &&
      emitter.timeElapsed >= emitter._duration + emitter.delay
    ) {
      emitter.isEmitting = false;
      if (!emitter.particles.length) emitter.alive = false;
    }
  }

  private emit(emitter: Raw, delta: number, afterEmission: number): void {
    // Rainbow is a newer native visual: preserve its column creation and 33ms
    // cadence while animating existing particles every render frame.
    const rate = emitter.rainbow
      ? 1 / 33
      : !read(emitter, 'constantEmitter') || emitter.steadyStream
        ? read(emitter, 'ppms')
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
    const limit = read(emitter, 'maxParticles');
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

  private draw(emitter: Raw, frameDelta: number): void {
    emitter.collectiveMeshBatch.clear();
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
      const rotation = read(particle, 'rotation'),
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
        x = read(particle, 'x') + Math.cos(rotation) * distance + emitter.gravityX * seconds;
        y = read(particle, 'y') + Math.sin(rotation) * distance + emitter.gravityY * seconds;
        if (emitter.centralGravity) {
          x = (x - emitter.posX) * pull + emitter.posX;
          y = (y - emitter.posY) * pull + emitter.posY;
        }
      }
      particle.set_x(x);
      particle.set_y(y);
      const size = (particle.startSize - particle.finishSize) * fraction + particle.finishSize;
      particle.set_scaleX(
        emitter.rainbow ? particle.rainbowLength / read(emitter._txt, 'width') : size,
      );
      particle.set_scaleY(size);
      if (!emitter.rainbow)
        particle.set_color(
          this.Color.interpolateColor(emitter._startColor, emitter._finishColor, 1 - fraction),
        );
      const alpha = (particle.startAlpha - particle.finishAlpha) * fraction + particle.finishAlpha;
      if (particle.ticks === 0) particle.set_blendMode('add');
      particle.ticks++;
      if (emitter.useFriction) particle.speed *= Math.pow(0.98, delta / 33);
      particle.ttl -= delta;
      if (emitter.isOnScreen) {
        vertices += 4;
        if (vertices >= 800) {
          this.Emitter.POOL_SIZE_MAX = 10;
          this.Emitter.POOL_SIZE_MIN = 2;
          break;
        }
        emitter.collectiveMeshBatch.addMesh(particle, null, alpha, null, false);
      }
    }
    if (this.Emitter.IS_HIGH_GRAPHICS && vertices < 400) this.Emitter.setHighGraphics();
  }
}

export function installEmitterFrames(api: API): void {
  const Emitter = api.cls('core.particle.Emitter');
  const Particle = api.cls('core.particle.Particle');
  const Color = api.cls('generics.Color');
  const Collective = api.cls('core.particle.CollectiveMeshBatch');
  if (!Emitter || !Particle || !Color || !Collective) return;
  const targets = new EmitterTargets(api.cls('core.engine.Engine'), api.cls('core.ship.EnemyShip'));
  const frames = new EmitterFrames(Particle, Emitter, Color, targets);
  // Unit.reset reaches GameObject.reset; Engine.reset does not call its base.
  for (const name of ['core.GameObject', 'core.engine.Engine']) {
    const prototype = api.cls(name)?.prototype;
    if (typeof prototype?.reset === 'function') {
      api.before(prototype, 'reset', function () {
        targets.resetTarget(this);
      });
    }
  }
  const factory = api.cls('core.particle.EmitterFactory');
  if (typeof factory?.create === 'function') {
    api.after(factory, 'create', function (emitters: Raw[] | null) {
      for (const emitter of emitters ?? []) targets.capture(emitter);
    });
  }
  api.around(Emitter.prototype, 'updateOnScreen', function () {
    updateEmitterVisibility(this);
  });
  api.before(Emitter.prototype, 'dispose', function () {
    frames.reset(this);
  });
  api.onGame((game, session) => {
    const manager = game.emitterManager;
    if (!manager) return;
    // The cached Game.update callback reaches parallax once per display frame,
    // after ship drawing. Suppress only this session's old tick-time emitter call.
    session.around(manager, 'update', function () {});
    session.before(game.parallaxManager, 'update', function (seconds: number) {
      if (read(game, 'isLeaving') || !manager.emitters) return;
      for (let index = manager.emitters.length - 1; index >= 0; index--) {
        const emitter = manager.emitters[index];
        if (emitter.alive) frames.update(emitter, seconds * 1000);
        else manager.removeEmitter(emitter, index);
      }
      Collective.AllMeshesAreUpdated();
    });
  });
}
