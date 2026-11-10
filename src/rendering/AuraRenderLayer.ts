import { read, type Raw } from '../api/Types';

/** Source AuraRenderLayer: world-space particles ordered immediately after their owner. */
export class AuraRenderLayer {
  private static owners = new WeakMap<Raw, Raw | null>();
  readonly display: Raw;
  private matrix: Raw;

  constructor(Sprite: any, Matrix: any) {
    this.display = new Sprite();
    this.display.set_touchable(false);
    this.matrix = new Matrix();
  }

  sync(owner: Raw | null, effects: Raw | null): void {
    const layer = this.display;
    AuraRenderLayer.owners.set(layer, owner);
    const destination = read(owner, 'parent');
    if (!owner || !destination || !effects) {
      layer.set_visible(false);
      layer.removeFromParent();
      return;
    }
    let index = destination.getChildIndex(owner) + 1;
    while (index < read(destination, 'numChildren')) {
      const sibling = destination.getChildAt(index);
      if (sibling === layer || AuraRenderLayer.owners.get(sibling) !== owner) break;
      index++;
    }
    if (read(layer, 'parent') !== destination || destination.getChildIndex(layer) !== index) {
      layer.removeFromParent();
      index = destination.getChildIndex(owner) + 1;
      destination.addChildAt(layer, index);
    }
    effects.getTransformationMatrix(destination, this.matrix);
    layer.set_transformationMatrix(this.matrix);
    layer.set_alpha(read(owner, 'alpha'));
    layer.set_visible(read(owner, 'visible') && read(effects, 'visible'));
  }

  dispose(): void {
    AuraRenderLayer.owners.delete(this.display);
    this.display.removeFromParent(true);
  }
}
