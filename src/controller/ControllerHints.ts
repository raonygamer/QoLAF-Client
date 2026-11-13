import { BitmapData, Image, Sprite, Text, Texture } from '../game/Bindings';
import { controllerButtonName, type ControllerStyle } from './ControllerIdentity';
import { xboxIcons } from './ControllerIcons';

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
        currentStyle === 'xbox'
          ? (xboxIcons[entry.button] ?? '')
          : currentStyle === 'playstation' && entry.button < 4
            ? `playstation:${entry.button}`
            : '';
      if (!textures.has('badge')) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 48;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#08090b';
          context.strokeStyle = '#454950';
          context.lineWidth = 2;
          context.beginPath();
          context.roundRect(1, 1, 46, 46, 10);
          context.fill();
          context.stroke();
          const bitmap = BitmapData.fromCanvas(canvas, true);
          if (bitmap)
            textures.set('badge', {
              bitmap,
              texture: Texture.fromBitmapData(bitmap, false, false, 1),
            });
        }
      }
      const badge = textures.get('badge');
      if (badge) {
        const image = new Image(badge.texture);
        image.set_width(24);
        image.set_height(24);
        image.set_x(x);
        node.addChild(image);
      }
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
        image.set_width(20);
        image.set_height(20);
        image.set_x(x + 2);
        image.set_y(2);
        node.addChild(image);
      } else if (asset && !asset.startsWith('playstation:') && !loading.has(asset)) {
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
      if (loaded && !entry.text) {
        x += 28;
        continue;
      }
      if (!asset) {
        const name = controllerButtonName(entry.button, currentStyle);
        const key = new Text(x + 3, 5);
        key.set_size(name.length > 2 ? 9 : 11);
        key.set_text(name);
        node.addChild(key);
        if (!entry.text) {
          x += 28;
          continue;
        }
      }
      const label = new Text(x + 28, 5);
      const name = controllerButtonName(entry.button, currentStyle);
      label.set_text(
        (currentStyle === 'xbox' || asset.startsWith('playstation:')) && loaded
          ? entry.text
          : entry.text,
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
