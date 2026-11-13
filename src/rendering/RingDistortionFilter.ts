import { read, type API, type Raw } from '../api/Types';
import { FragmentFilter } from '../game/Bindings';
import type { RingDistortionSource } from './RingDistortionSource';

export interface RingDistortionFilter extends FragmentFilter {
  compose(sources: readonly RingDistortionSource[]): boolean;
}

/** Shared stage-sized displacement pass using the Haxe renderer's native GPU primitives. */
export function createRingDistortionFilter(api: API): RingDistortionFilter {
  const FilterEffect = api.cls('starling.rendering.FilterEffect') as any;
  const FloatVector = api.cls('openfl._Vector.FloatVector') as any;
  const Program = api.cls('starling.rendering.Program')!;
  const Texture = api.cls('starling.textures.Texture')!;
  const RenderUtil = api.cls('starling.utils.RenderUtil')!;
  const Starling = api.cls('starling.core.Starling')!;

  class RingEffect extends FilterEffect {
    map: Raw | null = null;
    readonly coordinates = new FloatVector(4, false);
    readonly displacement = new FloatVector(4, false);

    createProgram(): Raw {
      return Program.fromSource(
        FilterEffect.STD_VERTEX_SHADER,
        [
          'mul ft1.xy, v0.xy, fc0.xy',
          'add ft1.xy, ft1.xy, fc0.zw',
          FilterEffect.tex('ft0', 'ft1', 1, this.map),
          'sub ft0.xy, ft0.xy, fc1.zz',
          'mul ft0.xy, ft0.xy, fc1.xy',
          'add ft1.xy, v0.xy, ft0.xy',
          FilterEffect.tex('oc', 'ft1', 0, this.get_texture()),
        ].join('\n'),
      );
    }

    get_programVariantName(): number {
      // The second sampler can independently use a rectangle or POT texture.
      return super.get_programVariantName() | (RenderUtil.getTextureVariantBits(this.map) << 4);
    }

    beforeDraw(context: Raw): void {
      super.beforeDraw(context);
      RenderUtil.setSamplerStateAt(1, false, 'bilinear', false);
      context.setTextureAt(1, read(this.map, 'base'));
      context.setProgramConstantsFromVector(0, 0, this.coordinates, 1);
      context.setProgramConstantsFromVector(0, 1, this.displacement, 1);
    }

    afterDraw(context: Raw): void {
      context.setTextureAt(1, null);
      super.afterDraw(context);
    }
  }

  class RingFilter extends FragmentFilter {
    private screenMap: Raw | null = null;
    private sources: readonly RingDistortionSource[] = [];
    private strength = 0;

    createEffect(): RingEffect {
      return new RingEffect();
    }

    compose(sources: readonly RingDistortionSource[]): boolean {
      this.sources = sources;
      this.strength = sources.reduce(
        (maximum, source) => Math.max(maximum, source.effectiveStrength),
        0,
      );
      const padding = Math.ceil(this.strength * 0.5);
      this.get_padding().setTo(padding, padding, padding, padding);
      this.setRequiresRedraw();
      return this.strength > 0.001;
    }

    private drawScreenMap(painter: Raw): Raw {
      const stage = read(Starling.get_current(), 'stage');
      const width = Math.max(2, Math.ceil(read(stage, 'stageWidth')));
      const height = Math.max(2, Math.ceil(read(stage, 'stageHeight')));
      if (
        !this.screenMap ||
        read(this.screenMap, 'width') !== width ||
        read(this.screenMap, 'height') !== height
      ) {
        const previous = this.screenMap;
        this.screenMap = Texture.empty(width, height, true, false, true, 1);
        previous?.dispose();
      }
      const map = this.screenMap!;
      const root = read(map, 'root');
      const cacheEnabled = read(painter, 'cacheEnabled');
      painter.finishMeshBatch();
      painter.pushState();
      painter.set_cacheEnabled(false);
      try {
        const state = read(painter, 'state');
        state.set_alpha(1);
        state.set_blendMode('normal');
        state.set_clipRect(null);
        state.setModelviewMatricesToIdentity();
        state.setRenderTarget(map, true, 0);
        state.setProjectionMatrix(0, 0, read(root, 'width'), read(root, 'height'), width, height);
        // A neutral opaque clear replaces RenderTexture's background Quad.
        painter.clear(0x808080, 1);
        for (const source of this.sources) {
          if (source.effectiveStrength <= 0.001) continue;
          source.prepareForRender(this.strength);
          painter.pushState();
          try {
            painter.setStateTo(
              read(source.image, 'transformationMatrix'),
              read(source.image, 'alpha'),
              'normal',
            );
            source.image.render(painter);
          } finally {
            painter.popState();
          }
        }
        painter.finishMeshBatch();
      } finally {
        painter.popState();
        painter.set_cacheEnabled(cacheEnabled);
      }
      return map;
    }

    process(painter: Raw, helper: Raw, input: Raw): Raw {
      const map = this.drawScreenMap(painter);
      const effect: RingEffect = this.get_effect();
      effect.map = map;
      const bounds = helper.get_targetBounds();
      const inputRoot = read(input, 'root');
      const mapRoot = read(map, 'root');
      const inputWidth = read(inputRoot, 'width');
      const inputHeight = read(inputRoot, 'height');
      const mapWidth = read(mapRoot, 'width');
      const mapHeight = read(mapRoot, 'height');
      // FilterHelper's padded stage bounds are the origin of the input texture.
      // Transform its UVs directly to stage-map UVs, including clipped bounds.
      for (const [index, value] of [
        inputWidth / mapWidth,
        inputHeight / mapHeight,
        bounds.x / mapWidth,
        bounds.y / mapHeight,
      ].entries())
        effect.coordinates.set(index, value);
      for (const [index, value] of [
        this.strength / inputWidth,
        this.strength / inputHeight,
        0.5,
        0,
      ].entries())
        effect.displacement.set(index, value);
      return super.process(painter, helper, input);
    }

    dispose(): void {
      super.dispose();
      this.screenMap?.dispose();
      this.screenMap = null;
      this.sources = [];
    }
  }

  for (const [type, base] of [
    [RingEffect, FilterEffect],
    [RingFilter, FragmentFilter],
  ]) {
    Object.assign(type, { __name__: 'qolaf.rendering.' + type.name, __super__: base });
    type.prototype.__class__ = type;
  }
  return new RingFilter();
}
