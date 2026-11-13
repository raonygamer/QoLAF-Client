import type {} from './Game';

// Registry.aliasProperties exposes these native Haxe getters to source-ported code.
declare module './Game' {
  namespace Game.starling.text {
    interface BitmapChar {
      readonly charID: number;
      readonly xOffset: number;
      readonly yOffset: number;
      readonly xAdvance: number;
      readonly width: number;
      readonly height: number;
      readonly texture: Game.starling.textures.Texture;
    }
  }
}
