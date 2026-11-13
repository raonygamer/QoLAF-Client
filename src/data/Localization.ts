import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Localize } from '../game/Bindings';
import Portuguese from '../assets/Portuguese.json';

export const english = 'en-US';
export const portuguese = 'pt-BR';

/** Original language choice, independent of Flash SharedObject storage. */
export function installLocalization(api: API): void {
  const reflection = new GameReflection(api);
  for (const [key, value] of Object.entries({ EN_US: english, PT_BR: portuguese })) {
    const original = Object.getOwnPropertyDescriptor(Localize, key);
    Object.defineProperty(Localize, key, { configurable: true, value });
    api.defer(() => {
      if (Object.getOwnPropertyDescriptor(Localize, key)?.value !== value) return;
      if (original) Object.defineProperty(Localize, key, original);
      else Reflect.deleteProperty(Localize, key);
    });
  }
  let language = english;
  let saved = false;
  try {
    const stored = api.storage.get<string | null>('language', null);
    if (stored !== null) {
      language = stored === portuguese ? portuguese : english;
      saved = true;
    }
  } catch {
    // Translation remains usable when browser storage is unavailable.
  }
  const previous = Object.getOwnPropertyDescriptor(Localize, 'language');
  const get = () => language;
  const set = (value: string) => {
    language = value === portuguese ? portuguese : english;
    try {
      api.storage.set('language', language);
      saved = true;
    } catch {
      // Match the original: keep the current choice even when saving fails.
    }
  };
  Object.defineProperty(Localize, 'language', { configurable: true, get, set });
  api.defer(() => {
    if (Object.getOwnPropertyDescriptor(Localize, 'language')?.get !== get) return;
    if (previous) Object.defineProperty(Localize, 'language', previous);
    else Reflect.deleteProperty(Localize, 'language');
  });
  reflection.around(Localize, 'setLocale', function (_next, locale = 'en_US') {
    if (!saved && locale?.toLowerCase().startsWith('pt')) set(portuguese);
  });
  const fallback: Record<string, string> = Portuguese;
  reflection.around(Localize, 't', function (_next, text) {
    if (text == null) return '';
    if (language === english) return text;
    const key = text.replace(/\W+/g, '').toLowerCase();
    const table = Localize.langObj?.[language];
    const translated =
      table && Object.hasOwn(table, key)
        ? table[key]
        : Object.hasOwn(fallback, key)
          ? fallback[key]
          : undefined;
    return translated ? translated.replace(/\\n/g, '\n') : text;
  });
}
