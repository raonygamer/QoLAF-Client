import { read, type Raw } from '../api/Types';

/** Native GameObject identity is required by EmitterFactory.resolveTexture. */
export function createMultipartAuraTarget(resolve: (name: string) => any): any {
  const GameObject = resolve('core.GameObject');
  const Matrix = resolve('openfl.geom.Matrix');
  class MultipartAuraTarget extends GameObject {
    private matrix = new Matrix();
    private renderAngle = 0;
    private mirrored = false;
    constructor(
      private clip: Raw,
      private container: Raw,
      private coordinateSpace: Raw,
    ) {
      super();
      this.isAddedToCanvas = true;
      this.updateTransform();
    }
    get_texture() {
      return read(this.clip, 'texture');
    }
    get_movieClip() {
      return this.clip;
    }
    get_auraDisplayObject() {
      return this.container;
    }
    get_renderX() {
      this.updateTransform();
      return this._pos.x;
    }
    get_renderY() {
      return this._pos.y;
    }
    get_renderRotation() {
      return this.renderAngle;
    }
    get_renderMirrored() {
      this.updateTransform();
      return this.mirrored;
    }
    get_pos() {
      this.updateTransform();
      return this._pos;
    }
    get_rotation() {
      this.updateTransform();
      return this.renderAngle;
    }
    private updateTransform(): void {
      const clip = this.clip,
        container = this.container;
      if (!clip || !container) return;
      if (this.coordinateSpace && read(clip, 'parent') && read(this.coordinateSpace, 'parent')) {
        const matrix = this.matrix;
        clip.getTransformationMatrix(this.coordinateSpace, matrix);
        this._pos.x = matrix.a * read(clip, 'pivotX') + matrix.c * read(clip, 'pivotY') + matrix.tx;
        this._pos.y = matrix.b * read(clip, 'pivotX') + matrix.d * read(clip, 'pivotY') + matrix.ty;
        this.renderAngle = Math.atan2(matrix.b, matrix.a);
        this.mirrored = matrix.a * matrix.d - matrix.b * matrix.c < 0;
      } else {
        const x = read(clip, 'x') * read(container, 'scaleX');
        const y = read(clip, 'y') * read(container, 'scaleY');
        const angle = read(container, 'rotation');
        this._pos.x = read(container, 'x') + x * Math.cos(angle) - y * Math.sin(angle);
        this._pos.y = read(container, 'y') + x * Math.sin(angle) + y * Math.cos(angle);
        this.renderAngle = angle + read(clip, 'rotation');
        this.mirrored =
          read(clip, 'scaleX') *
            read(clip, 'scaleY') *
            read(container, 'scaleX') *
            read(container, 'scaleY') <
          0;
      }
    }
  }
  Object.assign(MultipartAuraTarget, {
    __name__: 'qolaf.ship.MultipartAuraTarget',
    __super__: GameObject,
  });
  MultipartAuraTarget.prototype.__class__ = MultipartAuraTarget;
  return MultipartAuraTarget;
}
