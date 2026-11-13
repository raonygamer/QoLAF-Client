import { BitmapData, Image, Sprite, Text, Texture } from '../game/Bindings';
import { controllerButtonName, type ControllerStyle } from './ControllerIdentity';
import { genericIcon, xboxIcons } from './ControllerIcons';

/** All hint graphics are native Starling children, so scaling matches the game. */
export function createControllerHints(): {
  node: Sprite;
  update(
    style: Exclude<ControllerStyle, 'auto'>,
    entries: readonly { button: number; text: string }[],
  ): void;
  dispose(): void;
} {
  const node = new Sprite();
  node.set_touchable(false);
  const textures = new Map<string, { texture: Texture; bitmap: BitmapData }>();
  const loading = new Set<string>();
  let alive = true;
  let signature = '';
  let currentStyle: Exclude<ControllerStyle, 'auto'> = 'generic';
  let currentEntries: readonly { button: number; text: string }[] = [];
  function draw(): void {
    node.removeChildren(0, -1, true);
    let x = 0;
    for (const entry of currentEntries) {
      const asset =
        currentStyle === 'xbox' ? (xboxIcons[entry.button] ?? genericIcon) : genericIcon;
      if (asset.startsWith('playstation:') && !textures.has(asset)) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 48;
        const context = canvas.getContext('2d');
        if (context) {
          context.strokeStyle = ['#83bdff', '#ff8585', '#eca1e8', '#86e5bd'][entry.button];
          context.lineWidth = 4;
          context.lineCap = 'round';
          context.beginPath();
          if (entry.button === 0) {
            context.moveTo(12, 12);
            context.lineTo(36, 36);
            context.moveTo(36, 12);
            context.lineTo(12, 36);
          } else if (entry.button === 1) context.arc(24, 24, 15, 0, Math.PI * 2);
          else if (entry.button === 2) context.rect(10, 10, 28, 28);
          else {
            context.moveTo(24, 8);
            context.lineTo(41, 37);
            context.lineTo(7, 37);
            context.closePath();
          }
          context.stroke();
          const bitmap = BitmapData.fromCanvas(canvas, true);
          if (bitmap)
            textures.set(asset, {
              bitmap,
              texture: Texture.fromBitmapData(bitmap, false, false, 1),
            });
        }
      }
      const loaded = textures.get(asset);
      if (loaded) {
        const image = new Image(loaded.texture);
        image.set_width(24);
        image.set_height(24);
        image.set_x(x);
        node.addChild(image);
      } else if (!asset.startsWith('playstation:') && !loading.has(asset)) {
        loading.add(asset);
        const future = BitmapData.loadFromBase64(asset.slice(asset.indexOf(',') + 1), 'image/png');
        future.onComplete((bitmap) => {
          if (!alive) {
            bitmap.dispose();
            return;
          }
          if (bitmap)
            textures.set(asset, {
              bitmap,
              texture: Texture.fromBitmapData(bitmap, false, false, 1),
            });
          draw();
        });
        future.onError(() => {
          /* Text labels remain usable if an icon cannot be decoded. */
        });
      }
      const label = new Text(x + 28, 5);
      const name = controllerButtonName(entry.button, currentStyle);
      label.set_text(
        (currentStyle === 'xbox' || asset.startsWith('playstation:')) && loaded
          ? entry.text
          : `${name}: ${entry.text}`,
      );
      node.addChild(label);
      x += Math.max(95, label.get_width() + 48);
    }
  }
  return {
    node,
    update(style, entries) {
      const next = JSON.stringify([style, entries]);
      if (next === signature) return;
      signature = next;
      currentStyle = style;
      currentEntries = entries;
      draw();
    },
    dispose() {
      alive = false;
      node.removeFromParent(true);
      for (const { texture, bitmap } of textures.values()) {
        texture.dispose();
        bitmap.dispose();
      }
      textures.clear();
    },
  };
}
