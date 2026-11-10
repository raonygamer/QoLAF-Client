import { read, type API, type Raw } from '../api/Types';
import { auraShader } from './AuraShader';
import { networkTime } from './NetworkTime';

/** Native Haxe subclasses retain the source vertex format and AGAL shader programs. */
export function createAuraStyle(api: API): any {
  const cls = (name: string): any => {
    const value = api.cls(name);
    if (!value) throw Error(`Missing aura rendering class: ${name}`);
    return value;
  };
  const MeshStyle = cls('starling.styles.MeshStyle');
  const MeshEffect = cls('starling.rendering.MeshEffect');
  const FilterEffect = cls('starling.rendering.FilterEffect');
  const Program = cls('starling.rendering.Program');
  const Starling = cls('starling.core.Starling');
  const FloatVector = cls('openfl._Vector.FloatVector');
  const Point = cls('openfl.geom.Point');
  const Particle = cls('core.particle.Particle');
  const format = MeshStyle.VERTEX_FORMAT.extend('auraBounds:float4');
  const vanilla = () => !!api.cls('core.scene.SceneBase')?.clientSettings?.disableRemasteredAuras;
  const constrained = () => read(Starling.get_current(), 'profile') === 'baselineConstrained';
  const vector = (values: number[]) => new FloatVector(0, false, values);

  class GrayscaleAuraEffect extends MeshEffect {
    private luminance = vector([0.299, 0.587, 0.114, 0]);
    private texel = vector([1, 1, 1, 1]);
    private cubic = vector([1, 0.5, 1 / 6, 0]);
    private rim = vector([0.125, 0.5, 0.39, 0.44 * 5]);
    private flow = vector([0, 0, 0, Math.PI * 2]);
    private shape = vector([2 / 3, 1.5, 4, 3]);

    get_vertexFormat() {
      return format;
    }
    get_programVariantName() {
      return super.get_programVariantName() | (vanilla() ? 16 : 0) | (constrained() ? 32 : 0);
    }
    createProgram() {
      const source = auraShader(
        constrained() ? 'constrained' : vanilla() ? 'vanilla' : 'remastered',
        (destination, coordinates) =>
          FilterEffect.tex(destination, coordinates, 0, this.get_texture()),
      );
      return Program.fromSource(source.vertex, source.fragment);
    }
    beforeDraw(context: Raw) {
      super.beforeDraw(context);
      format.setVertexBufferAt(3, this.get_vertexBuffer(), 'auraBounds');
      const root = read(this.get_texture(), 'root');
      const width = Math.max(1, read(root, 'nativeWidth', 1));
      const height = Math.max(1, read(root, 'nativeHeight', 1));
      [width, height, 1 / width, 1 / height].forEach((value, index) =>
        this.texel.set(index, value),
      );
      this.flow.set(0, width / 48);
      this.flow.set(1, height / 80);
      let time = networkTime(api.game);
      if (!Number.isFinite(time)) time = performance.now();
      this.flow.set(2, (time % 3200) / 3200);
      [this.luminance, this.texel, this.cubic, this.rim, this.flow, this.shape].forEach(
        (value, index) => context.setProgramConstantsFromVector(0, index, value, 1),
      );
    }
    afterDraw(context: Raw) {
      context.setVertexBufferAt(3, null);
      super.afterDraw(context);
    }
  }
  Object.assign(GrayscaleAuraEffect, {
    __name__: 'qolaf.rendering.GrayscaleAuraEffect',
    __super__: MeshEffect,
  });
  GrayscaleAuraEffect.prototype.__class__ = GrayscaleAuraEffect;

  const corners = [new Point(), new Point(), new Point(), new Point()];
  const position = new Point();
  class GrayscaleAuraStyle extends MeshStyle {
    get_vertexFormat() {
      return format;
    }
    createEffect() {
      return new GrayscaleAuraEffect();
    }
    onTargetAssigned(mesh: Raw) {
      if (mesh instanceof Particle) this.prepareQuad();
    }
    prepareQuad() {
      const texture = this.get_texture(),
        vertices = this.get_vertexData();
      if (!texture || !vertices || read(vertices, 'numVertices') !== 4) return;
      const root = read(texture, 'root');
      const width = read(root, 'nativeWidth'),
        height = read(root, 'nativeHeight');
      if (!(width > 0) || !(height > 0)) return;
      texture.setupVertexPositions(vertices);
      texture.setupTextureCoordinates(vertices);
      for (let index = 0; index < 4; index++) vertices.getPoint(index, 'texCoords', corners[index]);
      const [origin, right, bottom, corner] = corners;
      const minU = Math.min(origin.x, right.x, bottom.x, corner.x) + 0.5 / width;
      const minV = Math.min(origin.y, right.y, bottom.y, corner.y) + 0.5 / height;
      const maxU = Math.max(origin.x, right.x, bottom.x, corner.x) - 0.5 / width;
      const maxV = Math.max(origin.y, right.y, bottom.y, corner.y) - 0.5 / height;
      const padU =
        2 / Math.max(1, Math.hypot((right.x - origin.x) * width, (right.y - origin.y) * height));
      const padV =
        2 / Math.max(1, Math.hypot((bottom.x - origin.x) * width, (bottom.y - origin.y) * height));
      for (let index = 0; index < 4; index++) {
        const left = (index & 1) === 0,
          top = index < 2;
        vertices.getPoint(index, 'position', position);
        vertices.setPoint(
          index,
          'position',
          position.x + (left ? -1 : 1) * padU * read(texture, 'width'),
          position.y + (top ? -1 : 1) * padV * read(texture, 'height'),
        );
        texture.setTexCoords(
          vertices,
          index,
          'texCoords',
          left ? -padU : 1 + padU,
          top ? -padV : 1 + padV,
        );
        vertices.setPoint4D(index, 'auraBounds', minU, minV, maxU, maxV);
      }
      this.setVertexDataChanged();
    }
  }
  Object.assign(GrayscaleAuraStyle, {
    __name__: 'qolaf.rendering.GrayscaleAuraStyle',
    __super__: MeshStyle,
  });
  GrayscaleAuraStyle.prototype.__class__ = GrayscaleAuraStyle;
  return GrayscaleAuraStyle;
}
