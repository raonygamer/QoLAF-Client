import { read, type Raw } from '../api/Types';

interface Attachment {
  target: Raw;
  generation: number;
}

/** Emitter.hasStaleTarget, with reset generations for the Haxe object pools. */
export class EmitterTargets {
  private generations = new WeakMap<Raw, number>();
  private attachments = new WeakMap<Raw, Attachment>();

  constructor(
    private Engine?: any,
    private EnemyShip?: any,
  ) {}

  resetTarget(target: Raw): void {
    this.generations.set(target, (this.generations.get(target) ?? 0) + 1);
  }

  release(emitter: Raw): void {
    this.attachments.delete(emitter);
  }

  capture(emitter: Raw): void {
    const target = emitter.target;
    if (!target) {
      this.release(emitter);
      return;
    }
    this.attachments.set(emitter, {
      target,
      generation: this.generations.get(target) ?? 0,
    });
  }

  stale(emitter: Raw): boolean {
    const target = emitter.target;
    if (!emitter.followTarget || !target) return false;
    let attachment = this.attachments.get(emitter);
    if (!attachment || attachment.target !== target) {
      // Factory-created effects are captured immediately, before any reset.
      // Also support callers that assign a different target directly.
      this.capture(emitter);
      attachment = this.attachments.get(emitter)!;
    }
    if (attachment.generation !== (this.generations.get(target) ?? 0)) return true;
    if (this.Engine && target instanceof this.Engine) {
      return !target.ship || target.ship.engine !== target || !target.ship.alive;
    }
    if (this.EnemyShip && target instanceof this.EnemyShip) {
      const id = read(target, 'id');
      return !(id > 0) || emitter.g.shipManager.enemiesById.h[id] !== target;
    }
    return false;
  }
}
