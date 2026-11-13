import type {} from './Game';

// Registry.aliasProperties exposes native Haxe getters to the source-ported renderer.
declare module './Game' {
  namespace Game.starling.text {
    interface BitmapFont {
      readonly name: string;
      readonly size: number;
      readonly lineHeight: number;
      readonly baseline: number;
      readonly offsetX: number;
      readonly offsetY: number;
      readonly smoothing: string;
    }
  }
}
