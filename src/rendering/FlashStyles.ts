import type { Resolve } from '../runtime/HaxeInterop';

/** Original direct-texture flashes, avoiding a cached filter render target. */
export function createFlashStyles(resolve: Resolve) {
  const MeshEffect = resolve('starling.rendering.MeshEffect');
  const MeshStyle = resolve('starling.styles.MeshStyle');
  const FilterEffect = resolve('starling.rendering.FilterEffect');
  const Program = resolve('starling.rendering.Program');
  const FloatVector = resolve('openfl._Vector.FloatVector');
  const vertex = 'm44 op, va0, vc0\nmov v0, va1\nmul v1, va2, vc4\n';
  class DamageFlashEffect extends MeshEffect {
    private brightness = new FloatVector(0, false, [0.5, 0, 0, 0]);
    get_programVariantName() {
      return super.get_programVariantName() | 64;
    }
    createProgram() {
      return Program.fromSource(
        vertex,
        FilterEffect.tex('ft0', 'v0', 0, this.get_texture()) +
          'mul ft0.w, ft0.w, v1.w\nmul ft0, ft0.wwww, fc0.xxxx\nmov oc, ft0\n',
      );
    }
    beforeDraw(context: any) {
      super.beforeDraw(context);
      context.setProgramConstantsFromVector(0, 0, this.brightness, 1);
    }
  }
  class KamikazeFlashEffect extends MeshEffect {
    get_programVariantName() {
      return super.get_programVariantName() | 128;
    }
    createProgram() {
      return Program.fromSource(
        vertex,
        FilterEffect.tex('ft0', 'v0', 0, this.get_texture()) +
          'mul ft0, ft0, v1\nsub ft0.xyz, ft0.www, ft0.xyz\nmov oc, ft0\n',
      );
    }
  }
  class DamageFlashStyle extends MeshStyle {
    createEffect() {
      return new DamageFlashEffect();
    }
  }
  class KamikazeFlashStyle extends MeshStyle {
    createEffect() {
      return new KamikazeFlashEffect();
    }
  }
  for (const [type, base] of [
    [DamageFlashEffect, MeshEffect],
    [KamikazeFlashEffect, MeshEffect],
    [DamageFlashStyle, MeshStyle],
    [KamikazeFlashStyle, MeshStyle],
  ]) {
    Object.assign(type, { __name__: 'qolaf.rendering.' + type.name, __super__: base });
    type.prototype.__class__ = type;
  }
  return { DamageFlashStyle, KamikazeFlashStyle };
}
