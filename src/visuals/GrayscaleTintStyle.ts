import type { Resolve } from '../runtime/HaxeInterop';

/** Original one-sample grayscale conversion before vertex tint; alpha is preserved. */
export function createGrayscaleTintStyle(resolve: Resolve): any {
  const MeshStyle = resolve('starling.styles.MeshStyle');
  const MeshEffect = resolve('starling.rendering.MeshEffect');
  const FilterEffect = resolve('starling.rendering.FilterEffect');
  const Program = resolve('starling.rendering.Program');
  const FloatVector = resolve('openfl._Vector.FloatVector');
  class GrayscaleTintEffect extends MeshEffect {
    private luminance = new FloatVector(0, false, [0.299, 0.587, 0.114, 0]);
    get_programVariantName() {
      return super.get_programVariantName() | 32;
    }
    createProgram() {
      return Program.fromSource(
        'm44 op, va0, vc0\nmov v0, va1\nmul v1, va2, vc4\n',
        FilterEffect.tex('ft0', 'v0', 0, this.get_texture()) +
          'dp3 ft1.x, ft0.xyz, fc0.xyz\nmov ft1.xyz, ft1.xxx\nmov ft1.w, ft0.w\nmul oc, ft1, v1\n',
      );
    }
    beforeDraw(context: any) {
      super.beforeDraw(context);
      context.setProgramConstantsFromVector(0, 0, this.luminance, 1);
    }
  }
  class GrayscaleTintStyle extends MeshStyle {
    createEffect() {
      return new GrayscaleTintEffect();
    }
  }
  for (const [type, base] of [
    [GrayscaleTintEffect, MeshEffect],
    [GrayscaleTintStyle, MeshStyle],
  ]) {
    Object.assign(type, { __name__: 'qolaf.visuals.' + type.name, __super__: base });
    type.prototype.__class__ = type;
  }
  return GrayscaleTintStyle;
}
