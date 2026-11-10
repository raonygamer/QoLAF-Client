import { readFileSync } from 'node:fs';
import { DOMParser } from 'linkedom';
import { Display, Format } from './NativeGame';
import { aliasProperties } from '../../src/Runtime/As3';
import {
  createBitmapTextAdapter,
  createBitmapFontTextFormat,
} from '../../src/UI/BitmapTextAdapter';
import { createRichBitmapFontTextRenderer } from '../../src/Ported/RichBitmapFontTextRenderer';
import { createRichBitmapGlyph } from '../../src/Ported/RichBitmapGlyph';
import { createRichBitmapLine } from '../../src/Ported/RichBitmapLine';
import { createText } from '../../src/Ported/Text';
import { RichBitmapMarkup } from '../../src/Chat/Rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from '../../src/Chat/Rich/RichBitmapMarkupParser';
import { RichBitmapInlineAtom } from '../../src/Chat/Rich/RichBitmapInlineAtom';
import { RichBitmapEmojiMatch } from '../../src/Chat/Rich/RichBitmapEmojiMatch';
import { RichBitmapEmojiResolver } from '../../src/Chat/Rich/RichBitmapEmojiResolver';

/** GPU-free layout fixture, using the original atlas's actual glyph metrics. */
export function bitmapRendererFixture() {
  const cleanup: (() => void)[] = [];
  aliasProperties({ defer: (fn: () => void) => cleanup.push(fn) } as any, Display);
  class Sprite extends Display {
    hasEventListener(type: string) {
      return this.listeners(type).length > 0;
    }
    removeEventListeners() {
      for (const type of Object.keys(this.__eventListeners.h))
        for (const listener of [...this.listeners(type)]) this.removeEventListener(type, listener);
    }
    setRequiresRedraw() {}
  }
  class Image extends Sprite {
    constructor(public texture: any) {
      super();
    }
    readjustSize() {}
  }
  class Batch extends Sprite {
    meshes: any[] = [];
    get numVertices() {
      return this.meshes.length * 4;
    }
    clear() {
      this.meshes = [];
    }
    addMesh(image: any) {
      this.meshes.push({
        x: image.x,
        y: image.y,
        scale: image.scaleX,
        color: image.color,
        texture: image.texture,
      });
    }
    setVertexColor(index: number, color: number) {
      this.meshes[Math.floor(index / 4)].color = color;
    }
  }
  class Point {
    constructor(
      public x = 0,
      public y = 0,
    ) {}
  }
  const xml = new DOMParser().parseFromString(
    readFileSync(new URL('../../src/assets/russo16_bitmap.fnt', import.meta.url), 'utf8'),
    'text/xml',
  );
  const glyphs = new Map<number, any>();
  for (const element of xml.querySelectorAll('char')) {
    const numeric = (name: string) => Number(element.getAttribute(name));
    glyphs.set(numeric('id'), {
      charID: numeric('id'),
      xOffset: numeric('xoffset'),
      yOffset: numeric('yoffset'),
      xAdvance: numeric('xadvance'),
      width: numeric('width'),
      texture: { width: numeric('width'), height: numeric('height'), frame: null },
      getKerning: (_previous: number) => 0,
    });
  }
  const font = {
    size: Number(xml.querySelector('info')!.getAttribute('size')),
    lineHeight: Number(xml.querySelector('common')!.getAttribute('lineHeight')),
    baseline: Number(xml.querySelector('common')!.getAttribute('base')),
    offsetX: 0,
    offsetY: 0,
    getChar: (id: number) => glyphs.get(id) ?? null,
  };
  const richPrefix = 'core.hud.components.chat.rich.';
  const definitions: Record<string, any> = {
    [richPrefix + 'RichBitmapMarkup']: RichBitmapMarkup,
    [richPrefix + 'RichBitmapMarkupParser']: RichBitmapMarkupParser,
    [richPrefix + 'RichBitmapInlineAtom']: RichBitmapInlineAtom,
    [richPrefix + 'RichBitmapEmojiMatch']: RichBitmapEmojiMatch,
    [richPrefix + 'RichBitmapEmojiResolver']: RichBitmapEmojiResolver,
    [richPrefix + 'JapaneseCachedGlyph']: class {},
    [richPrefix + 'JapaneseGlyphCache']: {
      whenReady() {},
      removeReadyCallback() {},
      prepare() {},
      acquire: () => null,
      release() {},
    },
    'starling.display.Sprite': Sprite,
    'starling.display.DisplayObjectContainer': Sprite,
    'starling.display.DisplayObject': Sprite,
    'starling.display.Image': Image,
    'starling.display.MeshBatch': Batch,
    'starling.text.BitmapChar': class {},
    'starling.text.BitmapFont': class {},
    'starling.text.TextFormat': Format,
    'starling.text.TextOptions': class {},
    'starling.text.TextField': { getBitmapFont: () => font },
    'starling.textures.Texture': class {},
    'starling.textures.TextureSmoothing': { BILINEAR: 'bilinear' },
    'starling.filters.GlowFilter': class {
      dispose() {}
    },
    'openfl.geom.Point': Point,
    'openfl.geom.Rectangle': class {
      x = 0;
      y = 0;
      width = 0;
      height = 0;
      setTo(x: number, y: number, width: number, height: number) {
        Object.assign(this, { x, y, width, height });
      }
    },
    'openfl.text.TextFormat': Format,
    'starling.utils.Align': {
      LEFT: 'left',
      CENTER: 'center',
      RIGHT: 'right',
      TOP: 'top',
      BOTTOM: 'bottom',
    },
    'starling.events.Event': {
      ADDED_TO_STAGE: 'addedToStage',
      REMOVED_FROM_STAGE: 'removedFromStage',
      ENTER_FRAME: 'enterFrame',
    },
    'core.hud.components.Style': { COLOR_CLIENT_DEVELOPER: 0xc2fc03 },
    'core.hud.components.chat.ChatRoleTags': { atVisibleIndex: () => null },
    'core.text.RussoBitmapFontRegistry': {
      PRIMARY_FONT_NAME: 'DAIDRR',
      COMBAT_FONT_NAME: 'DAIDRR_COMBAT',
      fontNameForSize: () => 'DAIDRR_16',
      register: () => font,
    },
    'core.text.VerdanaBitmapFontRegistry': { fontNameForSize: () => 'verdana16_bitmap' },
  };
  for (const name of [
    'ClientDeveloperTagColor',
    'EchoPulseColor',
    'RoomInvitePulseColor',
    'PodRewardPulseColor',
  ])
    definitions['core.hud.components.' + name] = {};
  const resolve = (name: string) => {
    if (!(name in definitions)) throw Error('Missing test dependency ' + name);
    return definitions[name];
  };
  definitions['feathers.controls.text.BaseTextRenderer'] = createBitmapTextAdapter(resolve);
  definitions['feathers.text.BitmapFontTextFormat'] = createBitmapFontTextFormat(resolve);
  definitions[richPrefix + 'RichBitmapGlyph'] = createRichBitmapGlyph(resolve);
  definitions[richPrefix + 'RichBitmapLine'] = createRichBitmapLine(resolve);
  const Renderer = createRichBitmapFontTextRenderer(resolve);
  definitions[richPrefix + 'RichBitmapFontTextRenderer'] = Renderer;
  const Text = createText(resolve);
  return {
    Renderer,
    Sprite,
    Text,
    font,
    BitmapFormat: definitions['feathers.text.BitmapFontTextFormat'],
    cleanup: () => cleanup.reverse().forEach((fn) => fn()),
  };
}
