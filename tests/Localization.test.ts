import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installLocalization } from '../src/data/Localization';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(stored: string | null = null, failStorage = false) {
  const localize = {
    language: 'en',
    langObj: null as Record<string, Record<string, string>> | null,
    t(text: string | null) {
      return text;
    },
    setLocale(_locale?: string | null) {},
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => (name === 'generics.Localize' ? localize : {}),
    around: (owner: object, key: string, callback: Function) => {
      const cleanup = hooks.add(owner, key, 'around', callback);
      cleanups.push(cleanup);
      return cleanup;
    },
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    storage: {
      get(_key: string, _fallback: unknown) {
        if (failStorage) throw Error('storage unavailable');
        return stored;
      },
      set(_key: string, value: string) {
        if (failStorage) throw Error('storage unavailable');
        stored = value;
      },
    },
  } as unknown as API;
  bindGameClasses(api);
  installLocalization(api);
  return { localize, saved: () => stored, dispose: () => cleanups.reverse().forEach((fn) => fn()) };
}

test('Portuguese locale translates original labels and preserves placeholders, fallback and persisted choices', () => {
  const f = fixture();
  try {
    assert.equal(f.localize.t('Play Now!'), 'Play Now!');
    f.localize.setLocale('PT_br');
    assert.equal(f.localize.language, 'pt-BR');
    assert.equal(f.saved(), 'pt-BR');
    assert.equal(f.localize.t('Play Now!'), 'Jogar agora!');
    assert.equal(f.localize.t('Minimum of [n] characters.'), 'Mínimo de [n] caracteres.');
    assert.equal(f.localize.t(null), '');
    assert.equal(f.localize.t('__proto__'), '__proto__');
    assert.equal(f.localize.t('Unknown new game message'), 'Unknown new game message');
    f.localize.langObj = { 'pt-BR': { playnow: 'Atualizado\\nAgora', empty: '' } };
    assert.equal(f.localize.t('Play Now!'), 'Atualizado\nAgora');
    assert.equal(f.localize.t('Empty'), 'Empty');
    f.localize.language = 'en-US';
    f.localize.setLocale('pt-BR');
    assert.equal(f.localize.language, 'en-US', 'saved choice wins over supplied locale');
  } finally {
    f.dispose();
  }
  assert.equal(f.localize.language, 'en');
  assert.equal(f.localize.t(null), null, 'native function restored on unload');
  const restored = fixture('pt-BR');
  try {
    assert.equal(restored.localize.t('Play Now!'), 'Jogar agora!');
  } finally {
    restored.dispose();
  }
});

test('invalid saved languages normalize to English and unavailable storage still permits translation', () => {
  const invalid = fixture('de');
  try {
    invalid.localize.setLocale('pt');
    assert.equal(invalid.localize.language, 'en-US');
  } finally {
    invalid.dispose();
  }
  const unavailable = fixture(null, true);
  try {
    unavailable.localize.setLocale('pt-BR');
    assert.equal(unavailable.localize.t('Play Now!'), 'Jogar agora!');
    unavailable.localize.language = 'unsupported';
    assert.equal(unavailable.localize.language, 'en-US');
  } finally {
    unavailable.dispose();
  }
});
