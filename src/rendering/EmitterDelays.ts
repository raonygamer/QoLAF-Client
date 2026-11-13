import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  DataLocator,
  DataManager,
  EmitterFactory,
  EmitterManager,
  TweenMax,
  Emitter,
  type GameObject,
  type Texture,
  type GameScene,
} from '../game/Bindings';
import type { EffectEmitter, EffectSequence } from '../game/EffectSequence';
import type { RenderedGameObject } from '../game/RenderedGameObject';
import { retainedEmitterLifetime } from './EmitterLifetime';
import { EmitterTargets, type EmitterTargetContext } from './EmitterTargets';

interface RetainedEmitter extends Emitter {
  retainUntilKilled?: boolean;
}

function positionFollowedEmitter(emitter: Emitter, target: GameObject | null): void {
  if (!emitter.followTarget) return;
  emitter.target = target;
  if (!target) return;
  const rendered: RenderedGameObject = target;
  emitter.posX = rendered.get_renderX?.() ?? target.get_x();
  emitter.posY = rendered.get_renderY?.() ?? target.get_y();
}

/** Original factory position validation and lifecycle-safe delayed multiple effects. */
export function installEmitterDelays(api: API, targets: EmitterTargets): void {
  const reflection = new GameReflection(api);
  const pending = new Set<() => void>();
  let disposed = false;
  // Scoped to synchronous native creation; nested effects restore their parent.
  let creation: {
    game: GameScene;
    key: string;
    target: GameObject | null;
    effect: EffectSequence;
    textures: Map<EffectEmitter, Texture>;
  } | null = null;
  reflection.before(Emitter.prototype, 'play', function () {
    if (creation && this.g === creation.game && this.key === creation.key) {
      // Native create plays before attaching the target; the original attaches
      // first so playback observes the rendered ship position immediately.
      positionFollowedEmitter(this, creation.target);
    }
  });
  reflection.around(DataManager.prototype, 'loadKey', function (next, table, key) {
    if (creation && table === 'Effects' && key === creation.key) return creation.effect;
    return next(table, key);
  });
  reflection.around(EmitterFactory, 'resolveTexture', function (next, definition, target) {
    return creation?.textures.get(definition) ?? next(definition, target);
  });
  reflection.after(EmitterManager.prototype, 'getEmitter', function (emitter) {
    if (emitter && creation?.game.emitterManager === this) {
      // A recycled emitter's cached texture must not bypass this request's preflight.
      emitter.oldImageKey = null;
    }
  });
  api.defer(() => {
    disposed = true;
    for (const callback of pending) TweenMax.killTweensOf(callback);
    pending.clear();
  });
  reflection.around(
    EmitterFactory,
    'create',
    function (
      next,
      key,
      game,
      x = NaN,
      y = NaN,
      target = null,
      play = false,
      addToRenderList = true,
      multipleAllowed = true,
      canvasTarget = null,
      retainUntilKilled = retainedEmitterLifetime(),
    ) {
      // loadKey reads the already-loaded JSON cache; it does not issue a request.
      const effect = DataLocator.getService().loadKey('Effects', key);
      if (game.get_isLeaving() || !effect) return null;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        if (target) {
          const rendered: RenderedGameObject = target;
          x = rendered.get_renderX?.() ?? target.get_x();
          y = rendered.get_renderY?.() ?? target.get_y();
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          api.log('Invalid position for emitter effect: ' + key);
          return [];
        }
      }
      if (effect.multiple && multipleAllowed) {
        const attachment: EmitterTargetContext = { g: game, target, followTarget: target !== null };
        targets.capture(attachment);
        const callback = () => {
          pending.delete(callback);
          if (disposed || game.get_isLeaving() || targets.stale(attachment)) return;
          const radius = Number(effect.multipleRadius);
          EmitterFactory.create(
            key,
            game,
            x + (radius - radius * 2 * Math.random()),
            y + (radius - radius * 2 * Math.random()),
            target,
            play,
            addToRenderList,
            false,
            canvasTarget,
            retainUntilKilled,
          );
        };
        pending.add(callback);
        try {
          TweenMax.delayedCall(Number(effect.multipleDelay) / 1000, callback);
        } catch (error) {
          pending.delete(callback);
          throw error;
        }
      }
      // Resolve the complete effect before checking out any pooled emitter.
      // Missing textures must not leave a partially allocated effect behind.
      const textures = new Map<EffectEmitter, Texture>();
      const parentCreation = creation;
      creation = null;
      try {
        for (const definition of effect.emitters) {
          const texture = EmitterFactory.resolveTexture(definition, target);
          if (!texture) return null;
          textures.set(definition, texture);
        }
      } finally {
        creation = parentCreation;
      }
      // Retain native emitter construction and newer rainbow behavior.
      // The source-compatible callback above owns multiple creation, so disable the
      // native closure that drops canvasTarget and truncates its coordinates.
      const previous = creation;
      // Original factory removed singleUse camera culling. Keep the shared JSON
      // untouched: only this native factory invocation sees the adjusted record.
      creation = { game, key, target, effect: { ...effect, singleUse: false }, textures };
      try {
        const emitters = next(key, game, x, y, target, play, addToRenderList, false, canvasTarget);
        for (const [index, emitter] of (emitters ?? []).entries()) {
          // Also initialize stopped effects: beam callers play them later.
          positionFollowedEmitter(emitter, target);
          const retained: RetainedEmitter = emitter;
          retained.retainUntilKilled = retainUntilKilled;
          emitter.delay = Number(effect.emitters[index]?.delay ?? 0);
        }
        return emitters;
      } finally {
        creation = previous;
      }
    },
  );
}
