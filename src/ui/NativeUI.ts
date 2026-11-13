import type { GameClassName, GameClasses } from '../game/Game';
import { GameReflection } from '../api/GameReflection';
import type {
  Sprite,
  Quad,
  StarlingTextField,
  Texture,
  DisplayObject,
  DisplayObjectContainer,
  TouchEvent,
} from '../game/Bindings';
import type { API } from '../api/Types';
export class NativeUI {
  constructor(readonly api: API) {}
  cls<K extends GameClassName>(name: K): GameClasses[K] {
    return new GameReflection(this.api).require(name);
  }
  sprite(): Sprite {
    return new (this.cls('starling.display.Sprite'))();
  }
  quad(w: number, h: number, color: number, alpha = 1): Quad {
    const q = new (this.cls('starling.display.Quad'))(Math.max(0.01, w), Math.max(0.01, h), color);
    q.set_alpha(alpha);
    return q;
  }
  text(
    w: number,
    h: number,
    text = '',
    size = 14,
    color = 0xffffff,
    align = 'left',
    font = 'DAIDRR_24',
  ): StarlingTextField {
    const f = new (this.cls('starling.text.TextFormat'))(font, size, color, align, 'center');
    const t = new (this.cls('starling.text.TextField'))(w, h, text, f);
    t.set_touchable(false);
    t.set_wordWrap(false);
    t.set_autoScale(false);
    t.set_pixelSnapping(false);
    return t;
  }
  image(texture: Texture) {
    return new (this.cls('starling.display.Image'))(texture);
  }
  findTexture(name: string, atlas?: string): Texture | null {
    const manager = this.cls('textures.TextureLocator').getService();
    return atlas
      ? manager.getTextureByTextureName(name, atlas)
      : manager.getTextureGUIByTextureName(name);
  }
  texture(name: string, atlas?: string): Texture {
    const texture = this.findTexture(name, atlas);
    if (!texture) throw new Error(`Missing game texture: ${name}${atlas ? ` in ${atlas}` : ''}`);
    return texture;
  }
  place<T extends DisplayObject>(
    child: T,
    x: number,
    y: number,
    parent?: DisplayObjectContainer,
  ): T {
    child.set_x(x);
    child.set_y(y);
    parent?.addChild(child);
    return child;
  }
  touch(target: DisplayObject, fn: () => void, phase = 'began') {
    const listener = (event: TouchEvent) => {
      if (event.getTouch(target, phase)) fn();
    };
    target.addEventListener('touch', listener);
    return () => target.removeEventListener('touch', listener);
  }
  button(label: string, fn: () => void) {
    return new (this.cls('core.hud.components.Button'))(fn, label);
  }
  dispose(object: DisplayObject) {
    const parent = object.get_parent();
    if (parent) parent.removeChild(object, true);
    else object.dispose();
  }
}
