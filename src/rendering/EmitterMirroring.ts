import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Emitter, EmitterFactory } from '../game/Bindings';
import type { RenderedGameObject } from '../game/RenderedGameObject';

interface MirroredEmitter extends Emitter {
  mirrorY?: boolean;
}

/** Source self-texture effects use unsigned hull size and a separate vertical reflection. */
export function installEmitterMirroring(api: API): void {
  const reflection = new GameReflection(api);
  reflection.after(EmitterFactory, 'create', function (emitters, _key, _game, _x, _y, target) {
    const clip = target?.get_movieClip();
    const scaleX = clip?.get_scaleX() ?? 1;
    const rendered: RenderedGameObject | null = target ?? null;
    const mirrored = rendered?.get_renderMirrored?.() ?? scaleX * (clip?.get_scaleY() ?? 1) < 0;
    for (const emitter of emitters ?? []) {
      const reflected: MirroredEmitter = emitter;
      // Pooled effects must not inherit the previous self texture's reflection.
      reflected.mirrorY = emitter.oldImageKey === 'self' && !!target && mirrored;
      if (emitter.oldImageKey === 'self' && target && scaleX < 0) {
        // Native create already multiplied by scaleX. Reverse that sign only;
        // retain authored negative sizes and the native size setter side effects.
        emitter.set_startSize(-emitter.get_startSize());
        emitter.set_finishSize(-emitter.get_finishSize());
      }
    }
  });
  reflection.before(Emitter.prototype, 'dispose', function () {
    const emitter: MirroredEmitter = this;
    emitter.mirrorY = false;
  });
}
