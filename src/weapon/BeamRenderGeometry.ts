import type { Beam, Unit } from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import type { RenderPoint } from './PhaseBladeMounts';

export function renderedClip(
  unit: RenderedGameObject,
): ReturnType<RenderedGameObject['get_movieClip']> {
  if (!unit.isAddedToCanvas || unit.hasRenderPosition === false) return null;
  return unit.get_movieClip();
}

export function renderPosition(unit: RenderedGameObject, result: RenderPoint): void {
  // Render accessors own pooled-object readiness and special engine poses.
  // Use the clip fallback only before those accessors have been installed.
  if (unit.get_renderX && unit.get_renderY) {
    result.x = unit.get_renderX();
    result.y = unit.get_renderY();
    return;
  }
  const clip = renderedClip(unit);
  result.x = unit.get_renderX?.() ?? clip?.get_x() ?? unit.get_x();
  result.y = unit.get_renderY?.() ?? clip?.get_y() ?? unit.get_y();
}

/** Separate render points: native Weapon endpoints remain simulation-owned. */
export class BeamRenderGeometry {
  readonly start = { x: 0, y: 0 };
  readonly second = { x: 0, y: 0 };
  readonly end = { x: 0, y: 0 };
  readonly chain = { x: 0, y: 0 };
  readonly last = { x: 0, y: 0 };
  twin = false;
  rotation = 0;

  update(
    weapon: Beam,
    mounts?: (first: RenderPoint, second: RenderPoint) => number,
    visualTarget: Unit | null | undefined = undefined,
  ): void {
    const unit = weapon.unit;
    if (!unit) return;
    renderPosition(unit, this.start);
    const x = this.start.x,
      y = this.start.y;
    const rendered: RenderedGameObject = unit;
    this.rotation =
      rendered.get_renderRotation?.() ?? renderedClip(unit)?.get_rotation() ?? unit.get_rotation();
    const localX = unit.weaponPos.x + weapon.positionOffsetX;
    const localY = unit.weaponPos.y + weapon.positionOffsetY;
    const distance = Math.hypot(localX, localY);
    const angle = this.rotation + Math.atan2(localY, localX);
    const muzzleX = x + Math.cos(angle) * distance;
    const muzzleY = y + Math.sin(angle) * distance;
    this.twin = !!weapon.twin;
    this.start.x = this.second.x = muzzleX;
    this.start.y = this.second.y = muzzleY;
    if (this.twin) {
      this.start.x += Math.cos(angle + Math.PI / 2) * weapon.twinOffset;
      this.start.y += Math.sin(angle + Math.PI / 2) * weapon.twinOffset;
      this.second.x += Math.cos(angle - Math.PI / 2) * weapon.twinOffset;
      this.second.y += Math.sin(angle - Math.PI / 2) * weapon.twinOffset;
    }
    const count = mounts?.(this.start, this.second) ?? 0;
    if (count > 0) this.twin = count > 1;
    if (weapon.targetBody) {
      renderPosition(weapon.targetBody, this.end);
      const dx = this.end.x - this.start.x,
        dy = this.end.y - this.start.y;
      const length = Math.hypot(dx, dy),
        radius = 0.6 * weapon.targetBody.get_radius();
      if (length > 0) {
        const fraction = length > radius ? (length - radius) / length : 0.6;
        this.end.x = this.start.x + dx * fraction;
        this.end.y = this.start.y + dy * fraction;
      }
    } else {
      const target = visualTarget === undefined ? weapon.target : visualTarget;
      if (target?.alive) renderPosition(target, this.end);
      else {
        this.end.x = x + Math.cos(angle) * weapon.range;
        this.end.y = y + Math.sin(angle) * weapon.range;
      }
    }
    this.last.x = this.end.x;
    this.last.y = this.end.y;
  }

  updateEmitters(weapon: Beam): void {
    for (const emitter of weapon.startEffect ?? []) {
      emitter.posX = this.start.x;
      emitter.posY = this.start.y;
      emitter.angle = this.rotation;
    }
    if (weapon.twin)
      for (const emitter of weapon.startEffect2 ?? []) {
        if (!this.twin) {
          emitter.stop();
          continue;
        }
        if (weapon._fire && !emitter.isEmitting) emitter.play();
        emitter.posX = this.second.x;
        emitter.posY = this.second.y;
        emitter.angle = this.rotation;
      }
    const angle = Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x) - Math.PI;
    for (const emitter of weapon.endEffect ?? []) {
      emitter.posX = this.end.x;
      emitter.posY = this.end.y;
      emitter.angle = angle;
    }
  }
}

const activeGeometry = new WeakMap<object, BeamRenderGeometry>();
export function getActiveBeamGeometry(weapon: object): BeamRenderGeometry | undefined {
  return activeGeometry.get(weapon);
}
export function setActiveBeamGeometry(weapon: Beam, view: BeamRenderGeometry | undefined): void {
  if (view) activeGeometry.set(weapon, view);
  else activeGeometry.delete(weapon);
}
