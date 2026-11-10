import type { Resolve } from '../Runtime/As3';
import { createBitmapTextAdapter, createBitmapFontTextFormat } from './BitmapTextAdapter';
import { RichBitmapMarkup } from '../Chat/Rich/RichBitmapMarkup';
import { RichBitmapMarkupParser } from '../Chat/Rich/RichBitmapMarkupParser';
import { RichBitmapEmojiMatch } from '../Chat/Rich/RichBitmapEmojiMatch';
import { RichBitmapInlineAtom } from '../Chat/Rich/RichBitmapInlineAtom';
import { RichBitmapEmojiResolver } from '../Chat/Rich/RichBitmapEmojiResolver';
import { RichBitmapTextNavigation } from '../Chat/Rich/RichBitmapTextNavigation';
import { JapaneseRuntimeFontLoader } from '../Chat/Rich/JapaneseRuntimeFontLoader';
import { createRichBitmapFontTextRenderer } from '../Ported/RichBitmapFontTextRenderer';
import { createRichBitmapGlyph } from '../Ported/RichBitmapGlyph';
import { createRichBitmapLine } from '../Ported/RichBitmapLine';
import { createRichBitmapTextMetrics } from '../Ported/RichBitmapTextMetrics';
import { createJapaneseGlyphCache } from '../Ported/JapaneseGlyphCache';
import { createJapaneseGlyphPage } from '../Ported/JapaneseGlyphPage';
import { createJapaneseCachedGlyph } from '../Ported/JapaneseCachedGlyph';
import { createText } from '../Ported/Text';
import { createClientDeveloperTagColor } from '../Ported/ClientDeveloperTagColor';
import { createEchoPulseColor } from '../Ported/EchoPulseColor';
import { createRoomInvitePulseColor } from '../Ported/RoomInvitePulseColor';
import { createPodRewardPulseColor } from '../Ported/PodRewardPulseColor';
import { createChatRoleTags } from '../Ported/ChatRoleTags';

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
