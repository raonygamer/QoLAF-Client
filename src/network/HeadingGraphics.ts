import type { Raw } from '../api/Types';
import type { CommandHeading } from './CommandAcknowledgements';

export interface DebugHeading extends CommandHeading {
  pos: { x: number; y: number };
  speed: { x: number; y: number };
  rotation: number;
}

export function snapshotHeading(heading: DebugHeading): DebugHeading {
  return {
    time: heading.time,
    pos: { x: heading.pos.x, y: heading.pos.y },
    speed: { x: heading.speed.x, y: heading.speed.y },
    rotation: heading.rotation,
    accelerate: heading.accelerate,
    deaccelerate: heading.deaccelerate,
    rotateLeft: heading.rotateLeft,
    rotateRight: heading.rotateRight,
  };
}

export function headingKeys(heading: DebugHeading): string {
  return `${heading.accelerate ? 'A' : '-'}${heading.deaccelerate ? 'B' : '-'}${heading.rotateLeft ? 'L' : '-'}${heading.rotateRight ? 'R' : '-'}`;
}

export function angleDifference(target: number, local: number): number {
  let difference = (target - local) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  else if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

export function formatReconciliation(
  raw: DebugHeading,
  replay: DebugHeading,
  local: DebugHeading,
  action: string,
): string {
  const dx = replay.pos.x - local.pos.x,
    dy = replay.pos.y - local.pos.y;
  const vx = replay.speed.x - local.speed.x,
    vy = replay.speed.y - local.speed.y;
  const age = local.time - raw.time;
  return (
    `age=${age.toFixed(0)}ms/~${Math.max(0, Math.round(age / 33))}t` +
    ` raw=${formatHeading(raw)} replay=${formatHeading(replay)} local=${formatHeading(local)}` +
    ` correction=pos(${dx.toFixed(2)},${dy.toFixed(2)})/${Math.hypot(dx, dy).toFixed(2)}` +
    ` vel(${vx.toFixed(2)},${vy.toFixed(2)})/${Math.hypot(vx, vy).toFixed(2)}` +
    ` rot=${((angleDifference(replay.rotation, local.rotation) * 180) / Math.PI).toFixed(2)}deg predicted=${action}`
  );
}

function formatHeading(heading: DebugHeading): string {
  return (
    `{t=${heading.time.toFixed(0)} p=${heading.pos.x.toFixed(2)},${heading.pos.y.toFixed(2)}` +
    ` v=${heading.speed.x.toFixed(2)},${heading.speed.y.toFixed(2)} r=${heading.rotation.toFixed(3)} keys=${headingKeys(heading)}}`
  );
}

/** Original PacketDebugWindow vector drawing, with the live target kept separate from receipt snapshots. */
export class HeadingGraphics {
  constructor(private graphics: Raw) {}

  draw(width: number, local: DebugHeading, target: DebugHeading | null): void {
    const g = this.graphics;
    g.clear();
    const x = Math.max(190, Math.min(435, (width - 12) * 0.54)) * 0.46;
    const y = 230 * 0.54;
    g.lineStyle(1, 0x263142, 0.8);
    g.drawCircle(x, y, 42);
    g.drawCircle(x, y, 84);
    if (target) {
      const offset = limitedVector(
        target.pos.x - local.pos.x,
        target.pos.y - local.pos.y,
        92,
        1.25,
      );
      const tx = x + offset.x,
        ty = y + offset.y;
      this.arrow(x, y, tx, ty, 0xe05cff, 2, 1);
      this.angular(
        x,
        y,
        local.rotation,
        angleDifference(target.rotation, local.rotation),
        82,
        0xff8a65,
        1,
      );
      this.velocity(tx, ty, target, 0xffd45c);
      this.heading(tx, ty, target.rotation, 0.55);
      this.turn(tx, ty, target, 60, 0xc783ff, 0.7);
      this.ship(tx, ty, target.rotation, 0xe05cff, 0.22);
    }
    this.velocity(x, y, local, 0x4edcff);
    this.heading(x, y, local.rotation, 1);
    this.turn(x, y, local, 50, 0x72a7ff, 1);
    this.ship(x, y, local.rotation, 0xffffff, 0.82);
  }

  private velocity(x: number, y: number, heading: DebugHeading, color: number): void {
    const vector = limitedVector(heading.speed.x, heading.speed.y, 76, 0.22 * 1.25);
    this.arrow(x, y, x + vector.x, y + vector.y, color, 1.5, 1);
  }
  private heading(x: number, y: number, rotation: number, alpha: number): void {
    this.arrow(
      x + Math.cos(rotation) * 24,
      y + Math.sin(rotation) * 24,
      x + Math.cos(rotation) * 72,
      y + Math.sin(rotation) * 72,
      0x74ff92,
      1.5,
      alpha,
    );
  }
  private turn(
    x: number,
    y: number,
    heading: DebugHeading,
    radius: number,
    color: number,
    alpha: number,
  ): void {
    const turn =
      heading.rotateLeft && !heading.rotateRight
        ? -0.95
        : heading.rotateRight && !heading.rotateLeft
          ? 0.95
          : 0;
    if (turn) this.angular(x, y, heading.rotation - turn * 0.5, turn, radius, color, alpha);
  }
  private angular(
    x: number,
    y: number,
    start: number,
    angle: number,
    radius: number,
    color: number,
    alpha: number,
  ): void {
    if (Math.abs(angle) < 0.01) return;
    const segments = Math.max(3, Math.min(18, Math.ceil(Math.abs(angle) / 0.12)));
    const g = this.graphics;
    g.lineStyle(1.5, color, alpha);
    g.moveTo(x + Math.cos(start) * radius, y + Math.sin(start) * radius);
    for (let segment = 1; segment <= segments; segment++) {
      const rotation = start + (angle * segment) / segments;
      g.lineTo(x + Math.cos(rotation) * radius, y + Math.sin(rotation) * radius);
    }
    const before = start + (angle * (segments - 1)) / segments;
    this.arrow(
      x + Math.cos(before) * radius,
      y + Math.sin(before) * radius,
      x + Math.cos(start + angle) * radius,
      y + Math.sin(start + angle) * radius,
      color,
      1.5,
      alpha,
    );
  }
  private arrow(
    x: number,
    y: number,
    endX: number,
    endY: number,
    color: number,
    width: number,
    alpha: number,
  ): void {
    const g = this.graphics;
    if (Math.abs(endX - x) < 0.1 && Math.abs(endY - y) < 0.1) {
      g.lineStyle(1, color, alpha);
      g.drawCircle(x, y, 2);
      return;
    }
    const rotation = Math.atan2(endY - y, endX - x);
    g.lineStyle(width, color, alpha);
    g.moveTo(x, y);
    g.lineTo(endX, endY);
    for (const offset of [-0.55, 0.55]) {
      g.moveTo(endX, endY);
      g.lineTo(endX - Math.cos(rotation + offset) * 6, endY - Math.sin(rotation + offset) * 6);
    }
  }
  private ship(x: number, y: number, rotation: number, color: number, alpha: number): void {
    const g = this.graphics,
      cos = Math.cos(rotation),
      sin = Math.sin(rotation);
    g.lineStyle(2.25, color, 1);
    g.beginFill(color, alpha);
    g.moveTo(x + cos * 30, y + sin * 30);
    g.lineTo(x + (-cos * 10 - sin * 8) * 2, y + (-sin * 10 + cos * 8) * 2);
    g.lineTo(x - cos * 12, y - sin * 12);
    g.lineTo(x + (-cos * 10 + sin * 8) * 2, y + (-sin * 10 - cos * 8) * 2);
    g.lineTo(x + cos * 30, y + sin * 30);
    g.endFill();
  }
}

export function limitedVector(
  x: number,
  y: number,
  limit: number,
  scale: number,
): { x: number; y: number } {
  x *= scale;
  y *= scale;
  const length = Math.hypot(x, y);
  if (length > limit && length > 0) {
    x *= limit / length;
    y *= limit / length;
  }
  return { x, y };
}
