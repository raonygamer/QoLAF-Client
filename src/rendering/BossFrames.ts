import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Boss, BossComponent, Spawner, Turret } from '../game/Bindings';

export interface BossPose {
  x: number;
  y: number;
  rotation: number;
}
const angleDelta = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));

/** Fixed tick endpoints; the first completed pose never blends from an uninitialized origin. */
export class BossPoseHistory {
  private previous?: BossPose;
  private current?: BossPose;
  record(pose: BossPose): void {
    this.previous = this.current ?? { ...pose };
    this.current = { ...pose };
  }
  snap(pose: BossPose): void {
    this.previous = this.current = { ...pose };
  }
  sample(alpha: number, fallback: BossPose): BossPose {
    if (!this.previous || !this.current) return fallback;
    const amount = Math.max(0, Math.min(1, alpha));
    return {
      x: this.previous.x + (this.current.x - this.previous.x) * amount,
      y: this.previous.y + (this.current.y - this.previous.y) * amount,
      rotation:
        this.previous.rotation +
        angleDelta(this.current.rotation - this.previous.rotation) * amount,
    };
  }
}

export function bossComponentPose(
  parent: BossPose,
  offset: { x: number; y: number },
  angle: number,
): BossPose {
  const cos = Math.cos(parent.rotation),
    sin = Math.sin(parent.rotation);
  return {
    x: parent.x + offset.x * cos - offset.y * sin,
    y: parent.y + offset.x * sin + offset.y * cos,
    rotation: parent.rotation + angle,
  };
}

export function installBossFrames(api: API): void {
  const reflection = new GameReflection(api);
  const histories = new WeakMap<Boss, BossPoseHistory>();
  const angles = new WeakMap<BossComponent, number>();
  const turretAngles = new WeakMap<Turret, number>();
  const nativePose = (boss: Boss): BossPose => ({
    x: boss.get_x(),
    y: boss.get_y(),
    rotation: boss.get_rotation(),
  });
  const spawnPose = (boss: Boss): BossPose =>
    boss.course
      ? { x: boss.course.pos.x, y: boss.course.pos.y, rotation: boss.course.rotation }
      : nativePose(boss);
  const history = (boss: Boss) => {
    let value = histories.get(boss);
    if (!value) {
      value = new BossPoseHistory();
      histories.set(boss, value);
    }
    return value;
  };
  const renderPose = (boss: Boss) =>
    history(boss).sample((boss.g.gameStateMachine?.accumulator ?? 0) / 33, spawnPose(boss));
  reflection.after(Boss.prototype, 'update', function () {
    if (this.alive && !this.awaitingActivation) history(this).record(nativePose(this));
  });
  reflection.after(Boss.prototype, 'overrideConvergeTarget', function (_result, x, y) {
    // Match the original authoritative teleport: simulation and display move together.
    this.set_x(x);
    this.set_y(y);
    history(this).snap(nativePose(this));
  });
  reflection.before(Boss.prototype, 'reset', function () {
    histories.delete(this);
  });
  for (const [method, field] of [
    ['get_renderX', 'x'],
    ['get_renderY', 'y'],
    ['get_renderRotation', 'rotation'],
  ] as const) {
    const previous = Object.getOwnPropertyDescriptor(Boss.prototype, method);
    const getter = function (this: Boss) {
      return renderPose(this)[field];
    };
    Object.defineProperty(Boss.prototype, method, {
      configurable: true,
      writable: true,
      value: getter,
    });
    api.defer(() => {
      if (Object.getOwnPropertyDescriptor(Boss.prototype, method)?.value !== getter) return;
      if (previous) Object.defineProperty(Boss.prototype, method, previous);
      else Reflect.deleteProperty(Boss.prototype, method);
    });
  }
  reflection.after(Spawner.prototype, 'draw', function () {
    if (!(this.parentObj instanceof Boss) || !this.offset || !this._mc) return;
    const pose = bossComponentPose(renderPose(this.parentObj), this.offset, this.angleOffset);
    this._mc.set_x(pose.x);
    this._mc.set_y(pose.y);
    this._mc.set_rotation(pose.rotation);
    if (this.miniBarsAreAddedToCanvas)
      for (const bar of [this.hpBar, this.shieldBar]) {
        bar.set_x(pose.x);
        bar.set_y(bar.get_y() + pose.y - this.get_y());
      }
  });
  // Turrets aim independently, but their mount position follows the boss's
  // interpolated root. Fixed guns inherit the root rotation without a tick delay.
  reflection.before(Turret.prototype, 'update', function () {
    if (this.active && this.alive) turretAngles.set(this, this.get_rotation());
  });
  reflection.before(Turret.prototype, 'reset', function () {
    turretAngles.delete(this);
  });
  reflection.after(Turret.prototype, 'draw', function () {
    if (!(this.parentObj instanceof Boss) || !this.offset || !this._mc) return;
    const parent = renderPose(this.parentObj);
    const pose = bossComponentPose(parent, this.offset, 0);
    const alpha = Math.max(0, Math.min(1, (this.g.gameStateMachine?.accumulator ?? 0) / 33));
    const current = this.get_rotation();
    const previous = turretAngles.get(this) ?? current;
    pose.rotation =
      this.aimArc === 0 && !this.forcedRotation
        ? parent.rotation + this.startAngle
        : previous + angleDelta(current - previous) * alpha;
    this._mc.set_x(pose.x);
    this._mc.set_y(pose.y);
    this._mc.set_rotation(pose.rotation);
    if (this.miniBarsAreAddedToCanvas)
      for (const bar of [this.hpBar, this.shieldBar]) {
        bar.set_x(pose.x);
        bar.set_y(bar.get_y() + pose.y - this.get_y());
      }
  });
  reflection.before(BossComponent.prototype, 'update', function () {
    if (this.active && this.alive) angles.set(this, this.currentAngleOffset);
  });
  reflection.before(BossComponent.prototype, 'reset', function () {
    angles.delete(this);
  });
  reflection.after(BossComponent.prototype, 'draw', function () {
    if (!(this.parentObj instanceof Boss) || !this.offset || !this._mc) return;
    const alpha = Math.max(0, Math.min(1, (this.g.gameStateMachine?.accumulator ?? 0) / 33));
    const current = this.currentAngleOffset;
    const previous = angles.get(this) ?? current;
    const pose = bossComponentPose(
      renderPose(this.parentObj),
      this.offset,
      previous + (current - previous) * alpha + this.imageAngle,
    );
    this._mc.set_x(pose.x);
    this._mc.set_y(pose.y);
    this._mc.set_rotation(pose.rotation);
    if (this.miniBarsAreAddedToCanvas)
      for (const bar of [this.hpBar, this.shieldBar]) {
        bar.set_x(pose.x);
        bar.set_y(bar.get_y() + pose.y - this.get_y());
      }
    if (this.effectTarget) {
      const effect = bossComponentPose(pose, { x: this.effectX, y: this.effectY }, 0);
      this.effectTarget.set_x(effect.x);
      this.effectTarget.set_y(effect.y);
      this.effectTarget.set_rotation(effect.rotation);
    }
  });
}
