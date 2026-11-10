import { read, type API, type Raw } from '../api/Types';
import { drawProjectileRibbon } from './RibbonFrames';
import { drawProjectileAttachment } from './ProjectileAttachments';

/** Source Projectile.draw: predict presentation between fixed 33 ms updates. */
export function drawProjectileFrame(
  projectile: Raw,
  rotationDelta: number,
  drawState?: () => void,
): void {
  const clip = projectile._mc;
  const course = projectile.course;
  if (!clip || !course || !projectile.alive) return;
  const alpha = Math.max(0, Math.min(1, projectile.g.gameStateMachine.accumulator / 33));
  clip.set_x(course.pos.x + course.speed.x * 0.033 * alpha);
  clip.set_y(course.pos.y + course.speed.y * 0.033 * alpha);
  clip.set_rotation(read(projectile, 'rotation', 0) + rotationDelta * alpha);
  drawState?.();
  drawProjectileRibbon(projectile);
}

/** Source ProjectileManager.draw: copy predicted meshes on EVERY display frame. */
export function rebuildProjectileBatch(manager: Raw): void {
  manager.meshBatch.clear();
  for (let index = manager.projectiles.length - 1; index >= 0; index--) {
    const projectile = manager.projectiles[index];
    if (
      projectile.alive &&
      projectile.isAddedToCanvas &&
      read(projectile, 'hasImage') &&
      projectile.isVisible
    )
      manager.meshBatch.addMesh(read(projectile, 'movieClip'));
  }
}

export function installProjectileFrames(api: API): void {
  const projectile = api.cls('core.projectile.Projectile')?.prototype;
  const game = api.cls('core.scene.Game')?.prototype;
  if (!projectile || !game) return;
  const rotations = new WeakMap<Raw, number>();
  const attachments = new WeakMap<Raw, { state: Raw; missile: boolean }>();
  for (const name of ['ProjectileStuck', 'MissileStuck']) {
    const state = api.cls(`core.states.aistates.${name}`)?.prototype;
    if (!state) continue;
    api.after(state, 'enter', function () {
      attachments.set(this.p, { state: this, missile: name === 'MissileStuck' });
    });
    api.before(state, 'exit', function () {
      if (attachments.get(this.p)?.state === this) attachments.delete(this.p);
    });
  }
  api.around(projectile, 'update', function (next, ...args) {
    const before = read(this, 'rotation', 0);
    const result = next(...args);
    const delta = read(this, 'rotation', 0) - before;
    rotations.set(this, Math.atan2(Math.sin(delta), Math.cos(delta)));
    return result;
  });
  api.before(projectile, 'reset', function () {
    rotations.delete(this);
    attachments.delete(this);
  });
  api.after(projectile, 'draw', function () {
    const attached = attachments.get(this);
    drawProjectileFrame(
      this,
      rotations.get(this) ?? 0,
      attached ? () => drawProjectileAttachment(attached.state, attached.missile) : undefined,
    );
  });
  // Haxe Game.draw already visits each visible projectile after the fixed ticks.
  // Its manager copied vertices only during update, leaving that draw invisible.
  api.after(game, 'draw', function () {
    if (this.projectileManager?.meshBatch) rebuildProjectileBatch(this.projectileManager);
  });
}
