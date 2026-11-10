import { read, type API, type Raw } from '../api/Types';

/** Source self-texture effects use unsigned hull size and a separate vertical reflection. */
export function installEmitterMirroring(api: API): void {
  const factory = api.cls('core.particle.EmitterFactory');
  const prototype = api.cls('core.particle.Emitter')?.prototype;
  if (!factory?.create || !prototype) return;

  api.after(
    factory,
    'create',
    function (
      emitters: Raw[] | null,
      _key: string,
      _game: Raw,
      _x: number,
      _y: number,
      target?: Raw,
    ) {
      const clip = read(target, 'movieClip');
      const scaleX = read(clip, 'scaleX', 1);
      const mirrored = read(target, 'renderMirrored', scaleX * read(clip, 'scaleY', 1) < 0);
      for (const emitter of emitters ?? []) {
        // Pooled effects must not inherit the previous self texture's reflection.
        emitter.mirrorY = emitter.oldImageKey === 'self' && !!target && mirrored;
        if (emitter.oldImageKey === 'self' && target && scaleX < 0) {
          // Native create already multiplied by scaleX. Reverse that sign only;
          // retain authored negative sizes and the native size setter side effects.
          emitter.set_startSize(-read(emitter, 'startSize'));
          emitter.set_finishSize(-read(emitter, 'finishSize'));
        }
      }
    },
  );
  api.before(prototype, 'dispose', function () {
    this.mirrorY = false;
  });
}
