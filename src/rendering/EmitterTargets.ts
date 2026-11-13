import type { Engine, EnemyShip } from '../game/Bindings';
import { staleProjectileThrust } from './ProjectileThrustAnchor';

/** Identity-only view shared by native emitters and delayed factory requests. */
export interface EmitterTargetContext {
  target?: object | null;
  followTarget?: boolean;
  g?: {
    shipManager: {
      enemiesById: { h: Readonly<Record<number, object | undefined>> };
    };
  };
}

interface Attachment {
  target: object;
  generation: number;
}

/** Emitter.hasStaleTarget, with reset generations for the Haxe object pools. */
export class EmitterTargets {
  private generations = new WeakMap<object, number>();
  private attachments = new WeakMap<object, Attachment>();

  constructor(
    private engineClass?: typeof Engine,
    private enemyShipClass?: typeof EnemyShip,
  ) {}

  resetTarget(target: object): void {
    this.generations.set(target, (this.generations.get(target) ?? 0) + 1);
  }

  release(emitter: object): void {
    this.attachments.delete(emitter);
  }

  capture(emitter: EmitterTargetContext): void {
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

  stale(emitter: EmitterTargetContext): boolean {
    const target = emitter.target;
    // EmitterManager checks ownership independently of position-following.
    // Only clearing target detaches an effect from a pooled object's life.
    if (!target) return false;
    if (staleProjectileThrust(target)) return true;
    let attachment = this.attachments.get(emitter);
    if (!attachment || attachment.target !== target) {
      // Factory effects are captured immediately; direct target reassignment
      // starts tracking that new object's current pooled life.
      attachment = { target, generation: this.generations.get(target) ?? 0 };
      this.attachments.set(emitter, attachment);
    }
    if (attachment.generation !== (this.generations.get(target) ?? 0)) return true;
    if (this.engineClass && target instanceof this.engineClass) {
      return !target.ship || target.ship.engine !== target || !target.ship.alive;
    }
    if (this.enemyShipClass && target instanceof this.enemyShipClass) {
      const id = target.get_id();
      return !(id > 0) || emitter.g?.shipManager.enemiesById.h[id] !== target;
    }
    return false;
  }
}
