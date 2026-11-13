import { installProjectileDiagnosticGetters } from '../game/ProjectileDiagnostics';
import { installTorpedoCourses } from '../projectile/TorpedoCourses';
import { GameReflection } from '../api/GameReflection';
import {
  GameScene,
  MissileStuck,
  ProjectileStuck,
  Projectile,
  ProjectileManager,
  SceneBase,
} from '../game/Bindings';
import type { API } from '../api/Types';
import { drawProjectileRibbon } from './RibbonFrames';
import { drawProjectileAttachment } from './ProjectileAttachments';
import { installInstantFrames } from './InstantFrames';
import { installNetherBeamStyle } from './NetherBeamStyle';
import { installNetherTentacleVisuals } from './NetherTentacleVisuals';
import { TorpedoFrames } from './TorpedoFrames';
import { installRibbonPool } from './RibbonPool';

const renderedCourseTimes = new WeakMap<Projectile, number>();

/** Source Projectile.draw: predict presentation between fixed 33 ms updates. */
export function drawProjectileFrame(
  projectile: Projectile,
  rotationDelta: number,
  drawState?: () => void,
  frameSeconds?: (projectile: Projectile, fallback: number) => number,
): void {
  const clip = projectile._mc;
  const course = projectile.course;
  if (!clip || !course || !projectile.alive) return;
  const alpha = Math.max(0, Math.min(1, (projectile.g.gameStateMachine?.accumulator ?? 33) / 33));
  const seconds = frameSeconds?.(projectile, 0.033 * alpha) ?? 0.033 * alpha;
  // Capture the timestamp represented by this pose before attached-state drawing.
  renderedCourseTimes.set(projectile, course.time + seconds * 1000);
  clip.set_x(course.pos.x + course.speed.x * seconds);
  clip.set_y(course.pos.y + course.speed.y * seconds);
  clip.set_rotation(projectile.get_rotation() + rotationDelta * alpha);
  drawState?.();
  drawProjectileRibbon(projectile);
}

/** Source ProjectileManager.draw: copy predicted meshes on EVERY display frame. */
export function rebuildProjectileBatch(manager: ProjectileManager): void {
  manager.meshBatch.clear();
  for (let index = manager.projectiles.length - 1; index >= 0; index--) {
    const projectile = manager.projectiles[index];
    if (
      projectile.alive &&
      projectile.isAddedToCanvas &&
      projectile.get_hasImage() &&
      projectile.isVisible
    ) {
      const clip = projectile.get_movieClip();
      if (clip) manager.meshBatch.addMesh(clip);
    }
  }
}

export function installProjectileFrames(api: API): void {
  const reflection = new GameReflection(api);
  const projectile = Projectile.prototype;
  const game = GameScene.prototype;
  installRibbonPool(api);
  installNetherBeamStyle(api);
  installNetherTentacleVisuals(api);
  const drawInstant = installInstantFrames(api);
  const rotations = new WeakMap<Projectile, number>();
  const torpedoes = new TorpedoFrames();
  installProjectileDiagnosticGetters(api, {
    get_serverBulletCourseEnabled() {
      return torpedoes.capturedSetting(this);
    },
    get_usesServerBulletCourse() {
      return torpedoes.usesServerCourse(this);
    },
    get_renderedCourseTime() {
      return renderedCourseTimes.get(this) ?? NaN;
    },
  });
  installTorpedoCourses(
    api,
    (projectile) => torpedoes.usesServerCourse(projectile),
    (projectile) => rotations.delete(projectile),
  );
  reflection.after(ProjectileManager.prototype, 'getProjectile', function (projectile) {
    // Capture the source option once per pooled life, not while a shot is flying.
    const enabled = SceneBase.clientSettings?.correctXhersixTorpedoPrediction;
    torpedoes.capture(projectile, typeof enabled === 'boolean' ? enabled : true);
  });
  reflection.before(game, 'draw', function () {
    torpedoes.beginFrame(this);
  });
  const attachments = new WeakMap<Projectile, MissileStuck | ProjectileStuck>();
  const retired = new WeakSet<MissileStuck | ProjectileStuck>();
  for (const State of [ProjectileStuck, MissileStuck]) {
    reflection.after(State.prototype, 'enter', function () {
      retired.delete(this);
      attachments.set(this.p, this);
    });
    reflection.before(State.prototype, 'exit', function () {
      retired.add(this);
      if (attachments.get(this.p) === this) attachments.delete(this.p);
    });
  }
  reflection.around(projectile, 'update', function (next, ...args) {
    const before = this.get_rotation();
    const result = next(...args);
    const delta = this.get_rotation() - before;
    rotations.set(this, Math.atan2(Math.sin(delta), Math.cos(delta)));
    return result;
  });
  reflection.before(projectile, 'reset', function () {
    renderedCourseTimes.delete(this);
    rotations.delete(this);
    const attached = attachments.get(this);
    if (attached) retired.add(attached);
    attachments.delete(this);
    torpedoes.reset(this);
  });
  reflection.after(projectile, 'draw', function () {
    const current = this.stateMachine?.currentState;
    // Adopt states entered before hot enable without repeating their gameplay
    // enter(). Native exitCurrent leaves currentState pointing at a retired state.
    if (
      (current instanceof MissileStuck || current instanceof ProjectileStuck) &&
      !retired.has(current)
    )
      attachments.set(this, current);
    const attached = attachments.get(this);
    drawProjectileFrame(
      this,
      rotations.get(this) ?? 0,
      () => {
        if (attached instanceof MissileStuck) drawProjectileAttachment(attached, true);
        else if (attached instanceof ProjectileStuck) drawProjectileAttachment(attached, false);
        drawInstant(this);
      },
      (projectile, fallback) => torpedoes.seconds(projectile, fallback),
    );
  });
  // Haxe Game.draw already visits each visible projectile after the fixed ticks.
  // Its manager copied vertices only during update, leaving that draw invisible.
  reflection.after(game, 'draw', function () {
    if (this.projectileManager?.meshBatch) rebuildProjectileBatch(this.projectileManager);
  });
}
