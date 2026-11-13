import assert from 'node:assert/strict';
import { bindGameClasses } from '../../src/game/Bindings';
import type { API } from '../../src/api/Types';
import { createPodRewardPulseColor } from '../../src/ported/PodRewardPulseColor';
import { createRoomInvitePulseColor } from '../../src/ported/RoomInvitePulseColor';
import { createEchoPulseColor } from '../../src/ported/EchoPulseColor';
import { createClientDeveloperTagColor } from '../../src/ported/ClientDeveloperTagColor';
import { readFileSync } from 'node:fs';
import { DOMParser } from 'linkedom';
import { Display, Format, Text as NativeText } from './NativeGame';
import { aliasProperties } from '../../src/runtime/HaxeInterop';
import {
  createBitmapTextAdapter,
  createBitmapFontTextFormat,
} from '../../src/ui/BitmapTextAdapter';
import { createRichBitmapFontTextRenderer } from '../../src/ported/RichBitmapFontTextRenderer';
import { createRichBitmapGlyph } from '../../src/ported/RichBitmapGlyph';
import { createRichBitmapLine } from '../../src/ported/RichBitmapLine';
import { createText } from '../../src/ported/Text';
import { RichBitmapMarkup } from '../../src/chat/rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from '../../src/chat/rich/RichBitmapMarkupParser';
import { RichBitmapInlineAtom } from '../../src/chat/rich/RichBitmapInlineAtom';
import { RichBitmapEmojiMatch } from '../../src/chat/rich/RichBitmapEmojiMatch';
import { RichBitmapEmojiResolver } from '../../src/chat/rich/RichBitmapEmojiResolver';
import { RichBitmapTextNavigation } from '../../src/chat/rich/RichBitmapTextNavigation';
import { createRichBitmapTextMetrics } from '../../src/ported/RichBitmapTextMetrics';
import { createChatRoleTags } from '../../src/ported/ChatRoleTags';

/** GPU-free layout fixture, using the original atlas's actual glyph metrics. */
export function bitmapRendererFixture(
  atlas:
    | 'russo16_bitmap'
    | 'verdana16_bitmap'
    | 'verdana24_bitmap'
    | 'verdana48_bitmap' = 'russo16_bitmap',
) {
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
    hitTestMask() {
      return true;
    }
    hitTest() {
      return null;
    }
  }
  class Image extends Sprite {
    constructor(public texture: any) {
      super();
    }
    readjustSize() {}
    set_texture(texture: typeof this.texture) {
      this.texture = texture;
      return texture;
    }
    set_color(color: number) {
      this.color = color;
      return color;
    }
    set_textureSmoothing(smoothing: string) {
      this.textureSmoothing = smoothing;
      return smoothing;
    }
  }
  class Batch extends Sprite {
    meshes: any[] = [];
    get numVertices() {
      return this.get_numVertices();
    }
    get_numVertices() {
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
    readFileSync(new URL(`../../src/assets/${atlas}.fnt`, import.meta.url), 'utf8'),
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
      height: numeric('height'),
      texture: {
        width: numeric('width'),
        height: numeric('height'),
        frame: null,
        get_frame: () => null,
        get_width: () => numeric('width'),
        get_height: () => numeric('height'),
      },
      getKerning: (_previous: number) => 0,
    });
  }
  const font = {
    get_name: () => 'DAIDRR',
    size: Number(xml.querySelector('info')!.getAttribute('size')),
    lineHeight: Number(xml.querySelector('common')!.getAttribute('lineHeight')),
    baseline: Number(xml.querySelector('common')!.getAttribute('base')),
    offsetX: 0,
    offsetY: 0,
    getChar: (id: number) => glyphs.get(id) ?? null,
  };
  // Native Haxe accessors remain after a plugin removes its temporary aliases.
  for (const glyph of glyphs.values()) {
    for (const key of ['texture', 'xOffset', 'yOffset', 'xAdvance', 'width']) {
      const value = glyph[key];
      Object.defineProperty(glyph, 'get_' + key, { value: () => value });
    }
  }
  for (const key of ['size', 'lineHeight', 'baseline', 'offsetX', 'offsetY'] as const) {
    const value = font[key];
    Object.defineProperty(font, 'get_' + key, { value: () => value });
  }
  Object.defineProperty(font, 'get_smoothing', { value: () => 'bilinear' });
  const richPrefix = 'core.hud.components.chat.rich.';
  const definitions: Record<string, any> = {
    [richPrefix + 'RichBitmapMarkup']: RichBitmapMarkup,
    [richPrefix + 'RichBitmapMarkupParser']: RichBitmapMarkupParser,
    [richPrefix + 'RichBitmapInlineAtom']: RichBitmapInlineAtom,
    [richPrefix + 'RichBitmapEmojiMatch']: RichBitmapEmojiMatch,
    [richPrefix + 'RichBitmapEmojiResolver']: RichBitmapEmojiResolver,
    [richPrefix + 'RichBitmapTextNavigation']: RichBitmapTextNavigation,
    [richPrefix + 'JapaneseCachedGlyph']: class {},
    [richPrefix + 'JapaneseGlyphCache']: {
      whenReady() {},
      removeReadyCallback() {},
      prepare() {},
      acquire: () => null,
      release() {},
    },
    'starling.display.Sprite': Sprite,
    'starling.display.Quad': class extends Sprite {
      color = 0;
      set_color(color: number) {
        this.color = color;
        return color;
      }
      get_color() {
        return this.color;
      }
      constructor(width: number, height: number, color: number) {
        super();
        this.set_width(width);
        this.set_height(height);
        (this as any).color = color;
      }
    },
    'starling.display.DisplayObjectContainer': Sprite,
    'starling.display.DisplayObject': Sprite,
    'starling.display.Image': Image,
    'starling.display.MeshBatch': Batch,
    'starling.text.BitmapChar': class {},
    'starling.text.BitmapFont': class {},
    'starling.text.TextFormat': Format,
    'starling.text.TextOptions': class {},
    'starling.text.TextField': class extends NativeText {
      static getBitmapFont() {
        return font;
      }
    },
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
    'core.text.VerdanaBitmapFontRegistry': {
      UI_24_FONT_NAME: 'verdana24_bitmap',
      fontNameForSize: () => 'verdana16_bitmap',
    },
  };
  definitions['generics.Localize'] = { t: (text: string) => text };
  definitions['core.scene.Game'] = { instance: null };
  const resolve = (name: string) => {
    if (!(name in definitions)) throw Error('Missing test dependency ' + name);
    return definitions[name];
  };
  definitions['core.hud.components.ClientDeveloperTagColor'] =
    createClientDeveloperTagColor(resolve);
  definitions['core.hud.components.chat.ChatRoleTags'] = createChatRoleTags(resolve);
  definitions['core.hud.components.EchoPulseColor'] = createEchoPulseColor(resolve);
  definitions['core.hud.components.RoomInvitePulseColor'] = createRoomInvitePulseColor(resolve);
  definitions['core.hud.components.PodRewardPulseColor'] = createPodRewardPulseColor(resolve);
  bindGameClasses({ cls: (name: string) => definitions[name] ?? {} } as unknown as API);
  definitions['feathers.controls.text.BaseTextRenderer'] = createBitmapTextAdapter(resolve);
  definitions['feathers.text.BitmapFontTextFormat'] = createBitmapFontTextFormat(resolve);
  definitions[richPrefix + 'RichBitmapGlyph'] = createRichBitmapGlyph(resolve);
  definitions[richPrefix + 'RichBitmapLine'] = createRichBitmapLine(resolve);
  definitions[richPrefix + 'RichBitmapTextMetrics'] = createRichBitmapTextMetrics(resolve);
  const Renderer = createRichBitmapFontTextRenderer(resolve);
  definitions[richPrefix + 'RichBitmapFontTextRenderer'] = Renderer;
  const Text = createText(resolve);
  return {
    resolve,
    Renderer,
    displayNode(node: object) {
      assert.ok(node instanceof Sprite);
      return node;
    },
    labelRenderer(text: InstanceType<typeof Text>) {
      const renderer = text.getChildAt(0);
      assert.ok(renderer instanceof Renderer);
      return renderer;
    },
    paintedGlyphs(renderer: InstanceType<typeof Renderer>) {
      const batch = renderer.getChildAt(0);
      assert.ok(batch instanceof Batch);
      return batch.meshes;
    },
    Sprite,
    Text,
    font,
    BitmapFormat: definitions['feathers.text.BitmapFontTextFormat'],
    cleanup: () => cleanup.reverse().forEach((fn) => fn()),
  };
}
