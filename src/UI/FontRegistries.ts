import type { Resolve } from '../Runtime/As3';

/** Size selection and public aliases from the two original font registries. */
export function createFontRegistries(resolve: Resolve) {
  const TextField = resolve('starling.text.TextField');
  class RussoBitmapFontRegistry {
    static readonly PRIMARY_FONT_NAME = 'DAIDRR';
    static readonly COMBAT_FONT_NAME = 'DAIDRR_COMBAT';
    static readonly DEVICE_FONT_ALIAS = '_sans';
    static readonly UI_24_FONT_NAME = 'DAIDRR_24';
    static fontNameForSize(size: number): string {
      if (!(size > 0) || size > 56) return this.PRIMARY_FONT_NAME;
      for (const atlasSize of [8, 16, 24, 32, 48])
        if (size <= atlasSize) return 'DAIDRR_' + atlasSize;
      return this.PRIMARY_FONT_NAME;
    }
    static register(): any {
      const font = TextField.getBitmapFont(this.PRIMARY_FONT_NAME);
      if (!font) throw Error('Load the original Russo font atlases before creating text');
      return font;
    }
  }
  class VerdanaBitmapFontRegistry {
    static readonly PRIMARY_FONT_NAME = 'verdana48_bitmap';
    static readonly UI_24_FONT_NAME = 'verdana24_bitmap';
    static readonly LEGACY_FONT_ALIAS = 'Verdana';
    static fontNameForSize(size: number): string {
      if (!(size > 0)) return this.PRIMARY_FONT_NAME;
      for (const atlasSize of [8, 16, 24, 32])
        if (size <= atlasSize) return 'verdana' + atlasSize + '_bitmap';
      return this.PRIMARY_FONT_NAME;
    }
    static registerLoadedFont(): any {
      const font = TextField.getBitmapFont(this.PRIMARY_FONT_NAME);
      if (!font) throw Error('Load the original Verdana font atlases before creating text');
      return font;
    }
  }
  return { RussoBitmapFontRegistry, VerdanaBitmapFontRegistry };
}
