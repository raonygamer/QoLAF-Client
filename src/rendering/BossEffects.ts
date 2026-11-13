import type { API } from '../api/Types';
import {
  BossComponent,
  BossFactory,
  EmitterFactory,
  type GameObject,
  type Emitter,
} from '../game/Bindings';

/** Start component effects only after their first active update establishes a position. */
export function installBossEffects(api: API): void {
  const pending = new Map<GameObject, Emitter[]>();
  const start = (target: GameObject) => {
    const effects = pending.get(target);
    if (!effects) return;
    pending.delete(target);
    for (const emitter of effects) {
      emitter.posX = target.get_x();
      emitter.posY = target.get_y();
      emitter.play();
    }
  };
  api.around(BossFactory, 'createBossComponent', function (next, definition, boss, game) {
    const restore = api.around(
      EmitterFactory,
      'create',
      function (create, key, scene, x, y, target, play, ...options) {
        if (scene !== game || !target) return create(key, scene, x, y, target, play, ...options);
        const effects = create(key, scene, x, y, target, false, ...options);
        if (effects) pending.set(target, effects);
        return effects;
      },
    );
    try {
      return next(definition, boss, game);
    } finally {
      restore();
    }
  });
  api.after(BossComponent.prototype, 'update', function () {
    if (this.active && this.alive) start(this.effectTarget);
  });
  for (const method of ['reset', 'destroy'] as const)
    api.before(BossComponent.prototype, method, function () {
      pending.delete(this.effectTarget);
    });
  api.defer(() => {
    // Native components do not own a deferred-start flag after hot disable.
    for (const target of pending.keys()) start(target);
    pending.clear();
  });
}
