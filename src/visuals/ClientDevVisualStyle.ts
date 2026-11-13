import { read, type Raw } from '../api/Types';
import type { Resolve } from '../runtime/HaxeInterop';
import { ClientDevVisual } from './ClientDevVisual';
import { clientDevVisualShader } from './ClientDevVisualShader';
import { networkTime } from '../rendering/NetworkTime';

/** Native Starling styles, using the source's additional hull-local coordinates. */
export function createClientDevVisualStyles(resolve: Resolve) {
  const MeshStyle = resolve('starling.styles.MeshStyle');
  const MeshEffect = resolve('starling.rendering.MeshEffect');
  const FilterEffect = resolve('starling.rendering.FilterEffect');
  const Program = resolve('starling.rendering.Program');
  const FloatVector = resolve('openfl._Vector.FloatVector');
  const Point = resolve('openfl.geom.Point');
  const Game = resolve('core.scene.Game');
  const format = MeshStyle.VERTEX_FORMAT.extend('devCoord:float2');
  const vector = (values: number[]) => new FloatVector(0, false, values);

  class ClientDevVisualEffect extends MeshEffect {
    mode = 0;
    phase = 0;
    settings = ClientDevVisual.defaults();
    tintTexture = false;
    private timing = vector([0, 0.5, 1.5, 0]);
    private direction = vector([0.5, 0.5, 0, 2]);
    private colorA = vector([0, 0, 0, 0]);
    private colorDelta = vector([0, 0, 0, 0]);
    private offsets = vector([0, 2 / 3, 1 / 3, 0]);
    private scale = vector([6, 3, 1, 0]);

    get_vertexFormat() {
      return format;
    }
    get_programVariantName() {
      return (
        super.get_programVariantName() |
        (this.mode << 4) |
        (ClientDevVisual.PALETTES.indexOf(this.settings.palette) << 6) |
        (this.tintTexture ? 256 : 0)
      );
    }
    createProgram() {
      const source = clientDevVisualShader(
        this.mode,
        this.settings,
        this.tintTexture,
        (target, coordinates) => FilterEffect.tex(target, coordinates, 0, this.get_texture()),
      );
      return Program.fromSource(source.vertex, source.fragment);
    }
    beforeDraw(context: Raw) {
      super.beforeDraw(context);
      format.setVertexBufferAt(3, this.get_vertexBuffer(), 'devCoord');
      this.timing.set(0, this.phase);
      this.timing.set(2, (1.5 * this.settings.spread) / 100);
      this.timing.set(3, this.settings.phase / 360);
      const angle = (this.settings.angle * Math.PI) / 180;
      this.direction.set(0, (Math.cos(angle) * Math.SQRT1_2 * this.settings.spread) / 100);
      this.direction.set(1, (Math.sin(angle) * Math.SQRT1_2 * this.settings.spread) / 100);
      for (let channel = 0; channel < 3; channel++) {
        const shift = 16 - channel * 8;
        const a = ((this.settings.colorA >> shift) & 255) / 255;
        const b = ((this.settings.colorB >> shift) & 255) / 255;
        this.colorA.set(channel, a);
        this.colorDelta.set(channel, b - a);
      }
      [this.timing, this.offsets, this.scale, this.direction, this.colorA, this.colorDelta].forEach(
        (value, index) => context.setProgramConstantsFromVector(0, index, value, 1),
      );
    }
    afterDraw(context: Raw) {
      context.setVertexBufferAt(3, null);
      super.afterDraw(context);
    }
  }

  class ClientDevVisualStyle extends MeshStyle {
    mode: number;
    private settings: any;
    private settingsKey: string;
    private tintTexture: boolean;
    constructor(mode = 0, settings: any = null, tintTexture = false) {
      super();
      this.mode = mode;
      this.settings = ClientDevVisual.settings(settings) ?? ClientDevVisual.defaults();
      this.settingsKey = ClientDevVisual.signature(this.settings)!;
      this.tintTexture = tintTexture;
    }
    get_vertexFormat() {
      return format;
    }
    createEffect() {
      return new ClientDevVisualEffect();
    }
    copyFrom(style: any) {
      super.copyFrom(style);
      if (style instanceof ClientDevVisualStyle) {
        this.mode = style.mode;
        this.settings = style.settings;
        this.settingsKey = style.settingsKey;
        this.tintTexture = style.tintTexture;
      }
    }
    canBatchWith(style: any) {
      return (
        style instanceof ClientDevVisualStyle &&
        this.mode === style.mode &&
        this.settingsKey === style.settingsKey &&
        this.tintTexture === style.tintTexture &&
        super.canBatchWith(style)
      );
    }
    onTargetAssigned(mesh: Raw) {
      const vertices = this.get_vertexData();
      if (read(vertices, 'numVertices') !== 4) return;
      for (let index = 0; index < 4; index++)
        vertices.setPoint(index, 'devCoord', index % 2, Math.floor(index / 2));
      this.setVertexDataChanged();
    }
    updateEffect(effect: any, state: Raw) {
      super.updateEffect(effect, state);
      effect.mode = this.mode;
      effect.settings = this.settings;
      effect.tintTexture = this.tintTexture;
      const time = networkTime(Game.instance);
      effect.phase = ClientDevVisual.phaseAt(Number.isFinite(time) ? time : 0, this.settings);
    }
  }

  class ClientDevBeamStyle extends ClientDevVisualStyle {
    private point = new Point();
    constructor(public palette: any = null) {
      super(palette?.mode ?? 0, palette?.settings ?? null, true);
    }
    copyFrom(style: any) {
      super.copyFrom(style);
      if (style instanceof ClientDevBeamStyle) this.palette = style.palette;
    }
    mapCoordinates(transform: Raw) {
      const vertices = this.get_vertexData();
      for (let index = 0; index < read(vertices, 'numVertices', 0); index++) {
        vertices.getPoint(index, 'position', this.point);
        vertices.setPoint(
          index,
          'devCoord',
          transform.a * this.point.x + transform.c * this.point.y + transform.tx,
          transform.b * this.point.x + transform.d * this.point.y + transform.ty,
        );
      }
      this.setVertexDataChanged();
    }
  }
  for (const [type, base] of [
    [ClientDevVisualEffect, MeshEffect],
    [ClientDevVisualStyle, MeshStyle],
    [ClientDevBeamStyle, ClientDevVisualStyle],
  ]) {
    Object.assign(type, { __name__: 'qolaf.visuals.' + type.name, __super__: base });
    type.prototype.__class__ = type;
  }
  return { ClientDevVisualStyle, ClientDevBeamStyle };
}
