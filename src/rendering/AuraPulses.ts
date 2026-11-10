import { type API, type Raw } from '../api/Types';

interface Aura {
  blue: boolean;
}

/** Source Emitter.softAuraAlpha and applyBlueAuraBreathing. */
export class AuraPulses {
  private auras = new WeakMap<Raw, Aura>();

  constructor(
    private enabled: () => boolean,
    private Color: Raw,
  ) {}

  prepare(emitter: Raw, rarity: number): void {
    this.auras.set(emitter, { blue: rarity === 1 });
  }

  release(emitter: Raw): void {
    this.auras.delete(emitter);
  }

  apply(emitter: Raw, particle: Raw, lifeRemaining: number, nativeAlpha: number): number {
    const aura = this.auras.get(emitter);
    if (!aura || !this.enabled()) return nativeAlpha;
    const age = Math.max(0, Math.min(1, 1 - lifeRemaining));
    if (!aura.blue) {
      const phase = age < 0.2 ? age / 0.2 : (1 - age) / 0.8;
      return particle.startAlpha * phase * phase * (3 - 2 * phase);
    }
    const wave = Math.sin(((emitter.timeElapsed % 6000) / 6000) * Math.PI * 2);
    const size = ((emitter._startSize + emitter._finishSize) / 2) * (1 + 0.018 * wave);
    particle.set_scaleX(size);
    particle.set_scaleY(emitter.mirrorY ? -size : size);
    particle.set_color(
      this.Color.interpolateColor(emitter._startColor, emitter._finishColor, 0.42),
    );
    return particle.startAlpha * 0.5 * (1 - Math.cos(age * Math.PI * 2)) * (1 + 0.05 * wave);
  }
}

export function installAuraPulses(api: API): AuraPulses | undefined {
  const factory = api.cls('core.particle.EmitterFactory');
  const emitter = api.cls('core.particle.Emitter')?.prototype;
  const Color = api.cls('generics.Color');
  if (!factory?.createRareType || !emitter || !Color) return;
  const pulses = new AuraPulses(
    () => !api.cls('core.scene.SceneBase')?.clientSettings?.disableRemasteredAuras,
    Color,
  );
  api.after(
    factory,
    'createRareType',
    function (emitters: Raw[] | null, _game: Raw, _target: Raw, rarity = 0) {
      for (const emitter of emitters ?? []) pulses.prepare(emitter, rarity);
    },
  );
  api.before(emitter, 'dispose', function () {
    pulses.release(this);
  });
  return pulses;
}
