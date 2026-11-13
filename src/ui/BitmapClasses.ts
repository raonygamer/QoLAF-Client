import { createRichBitmapFontCompositor } from '../ported/RichBitmapFontCompositor';
import type { Resolve } from '../runtime/HaxeInterop';
import { createBitmapTextAdapter, createBitmapFontTextFormat } from './BitmapTextAdapter';
import { RichBitmapMarkup } from '../chat/rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from '../chat/rich/RichBitmapMarkupParser';
import { RichBitmapEmojiMatch } from '../chat/rich/RichBitmapEmojiMatch';
import { RichBitmapInlineAtom } from '../chat/rich/RichBitmapInlineAtom';
import { RichBitmapEmojiResolver } from '../chat/rich/RichBitmapEmojiResolver';
import { RichBitmapTextNavigation } from '../chat/rich/RichBitmapTextNavigation';
import { JapaneseRuntimeFontLoader } from '../chat/rich/JapaneseRuntimeFontLoader';
import { createRichBitmapFontTextRenderer } from '../ported/RichBitmapFontTextRenderer';
import { createRichBitmapGlyph } from '../ported/RichBitmapGlyph';
import { createRichBitmapLine } from '../ported/RichBitmapLine';
import { createRichBitmapTextMetrics } from '../ported/RichBitmapTextMetrics';
import { createJapaneseGlyphCache } from '../ported/JapaneseGlyphCache';
import { createJapaneseGlyphPage } from '../ported/JapaneseGlyphPage';
import { createJapaneseCachedGlyph } from '../ported/JapaneseCachedGlyph';
import { createText } from '../ported/Text';
import { createClientDeveloperTagColor } from '../ported/ClientDeveloperTagColor';
import { createEchoPulseColor } from '../ported/EchoPulseColor';
import { createRoomInvitePulseColor } from '../ported/RoomInvitePulseColor';
import { createPodRewardPulseColor } from '../ported/PodRewardPulseColor';
import { createChatRoleTags } from '../ported/ChatRoleTags';

/** One source renderer dependency graph, shared by all labels in an activation. */
export function createBitmapClasses(nativeResolve: Resolve) {
  const cache: Record<string, any> = {
    'core.hud.components.chat.rich.RichBitmapMarkup': RichBitmapMarkup,
    'core.hud.components.chat.rich.RichBitmapMarkupParser': RichBitmapMarkupParser,
    'core.hud.components.chat.rich.RichBitmapEmojiMatch': RichBitmapEmojiMatch,
    'core.hud.components.chat.rich.RichBitmapInlineAtom': RichBitmapInlineAtom,
    'core.hud.components.chat.rich.RichBitmapEmojiResolver': RichBitmapEmojiResolver,
    'core.hud.components.chat.rich.RichBitmapTextNavigation': RichBitmapTextNavigation,
    'core.hud.components.chat.rich.JapaneseRuntimeFontLoader': JapaneseRuntimeFontLoader,
  };
  const factories: Record<string, (resolve: Resolve) => any> = {
    'core.hud.components.chat.rich.RichBitmapFontTextRenderer': createRichBitmapFontTextRenderer,
    'core.hud.components.chat.rich.RichBitmapGlyph': createRichBitmapGlyph,
    'core.hud.components.chat.rich.RichBitmapLine': createRichBitmapLine,
    'core.hud.components.chat.rich.RichBitmapTextMetrics': createRichBitmapTextMetrics,
    'core.hud.components.chat.rich.JapaneseGlyphCache': createJapaneseGlyphCache,
    'core.hud.components.chat.rich.JapaneseGlyphPage': createJapaneseGlyphPage,
    'core.hud.components.chat.rich.JapaneseCachedGlyph': createJapaneseCachedGlyph,
    'core.hud.components.Text': createText,
    'core.text.RichBitmapFontCompositor': createRichBitmapFontCompositor,
    'core.hud.components.ClientDeveloperTagColor': createClientDeveloperTagColor,
    'core.hud.components.EchoPulseColor': createEchoPulseColor,
    'core.hud.components.RoomInvitePulseColor': createRoomInvitePulseColor,
    'core.hud.components.PodRewardPulseColor': createPodRewardPulseColor,
    'core.hud.components.chat.ChatRoleTags': createChatRoleTags,
    'feathers.controls.text.BaseTextRenderer': createBitmapTextAdapter,
    'feathers.text.BitmapFontTextFormat': createBitmapFontTextFormat,
  };
  const resolve: Resolve = (name) => {
    if (cache[name]) return cache[name];
    if (name === 'core.hud.components.Style') {
      return (cache[name] = Object.assign(Object.create(nativeResolve(name)), {
        COLOR_CLIENT_DEVELOPER: 0xff6666,
      }));
    }
    const factory = factories[name];
    return (cache[name] = factory ? factory(resolve) : nativeResolve(name));
  };
  return { resolve };
}
