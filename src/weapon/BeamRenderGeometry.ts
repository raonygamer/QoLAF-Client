import { read, type Raw } from '../api/Types';
import type { RenderPoint } from './PhaseBladeMounts';

export function renderedClip(unit: Raw): Raw | null {
  if (unit.isAddedToCanvas === false || unit.hasRenderPosition === false) return null;
  return read(unit, 'movieClip', unit._mc) ?? null;
}

export function renderPosition(unit: Raw, result: RenderPoint): void {
  const clip = renderedClip(unit);
  const position = read(unit, 'pos', unit);
  result.x = read(clip, 'x', read(unit, 'x', position.x));
  result.y = read(clip, 'y', read(unit, 'y', position.y));
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

  update(weapon: Raw, mounts?: (first: RenderPoint, second: RenderPoint) => number): void {
    const unit = weapon.unit;
    renderPosition(unit, this.start);
    const x = this.start.x,
      y = this.start.y;
    this.rotation = read(renderedClip(unit), 'rotation', read(unit, 'rotation', 0));
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
        radius = 0.6 * read(weapon.targetBody, 'radius');
      if (length > 0) {
        const fraction = length > radius ? (length - radius) / length : 0.6;
        this.end.x = this.start.x + dx * fraction;
        this.end.y = this.start.y + dy * fraction;
      }
    } else if (weapon.target?.alive) renderPosition(weapon.target, this.end);
    else {
      this.end.x = x + Math.cos(angle) * weapon.range;
      this.end.y = y + Math.sin(angle) * weapon.range;
    }
    this.last.x = this.end.x;
    this.last.y = this.end.y;
  }

  updateEmitters(weapon: Raw): void {
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

const activeGeometry = new WeakMap<Raw, BeamRenderGeometry>();
export function getActiveBeamGeometry(weapon: Raw): BeamRenderGeometry | undefined {
  return activeGeometry.get(weapon);
}
export function setActiveBeamGeometry(weapon: Raw, view: BeamRenderGeometry | undefined): void {
  if (view) activeGeometry.set(weapon, view);
  else activeGeometry.delete(weapon);
}
