import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registry } from './fixtures/NativeGame';
// @ts-expect-error Real host hook implementation.
import { Hooks } from './fixtures/HostCore.js';

test('native radio commands stay local, validate bridge addresses and do not start media on installation', async () => {
  const built = await build({
    entryPoints: ['src/radio/NativeRadio.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    loader: { '.woff': 'dataurl', '.png': 'dataurl', '.mp3': 'dataurl' },
  });
  const temporary = await mkdtemp(path.join(tmpdir(), 'qolaf-radio-test-'));
  const modulePath = path.join(temporary, 'NativeRadio.mjs');
  await writeFile(modulePath, built.outputFiles[0].text);
  const { installNativeRadio } = await import(pathToFileURL(modulePath).href);
  const priorWindow = globalThis.window,
    priorDocument = globalThis.document;
  Object.assign(globalThis, { window: new EventTarget(), document: { activeElement: null } });
  const classes = registry();
  const notes: string[] = [];
  classes['core.hud.components.chat.MessageLog'] = {
    write: (message: string) => notes.push(message),
  };
  const cleanups: (() => void)[] = [];
  const hooks = new Hooks();
  const storage = new Map<string, unknown>();
  let draft = '',
    ordinary = 0,
    intervals = 0;
  const originalOpen = () => {};
  const chat: any = {
    openRadio: originalOpen,
    input: {
      get_text: () => draft,
      set_text: (value: string) => {
        draft = value;
      },
    },
    parseCommand: (text: string) => {
      const i = text.indexOf(' ');
      return i < 0 ? [text.slice(1)] : [text.slice(1, i), text.slice(i + 1)];
    },
    updateTab() {},
    sendMessage() {
      ordinary++;
    },
  };
  const game: any = { chatInput: chat, addChildToOverlay() {}, removeChildFromOverlay() {} };
  const api: any = {
    game,
    cls: (name: string) => classes[name],
    defer: (cleanup: () => void) => {
      cleanups.push(cleanup);
      return cleanup;
    },
    interval: () => {
      intervals++;
      return () => {};
    },
    around: (target: object, key: string, callback: Function) => {
      const cleanup = hooks.add(target, key, 'around', callback);
      cleanups.push(cleanup);
      return cleanup;
    },
    after: (target: object, key: string, callback: Function) => {
      const cleanup = hooks.add(target, key, 'after', callback);
      cleanups.push(cleanup);
      return cleanup;
    },
    storage: {
      get: (key: string, fallback: unknown) => storage.get(key) ?? fallback,
      set: (key: string, value: unknown) => storage.set(key, value),
    },
  };
  try {
    const radio = installNativeRadio(api, {} as any);
    radio.installSession(game, api);
    assert.equal(intervals, 1, 'only invitation ownership poll, no audio/session worker');
    assert.notEqual(chat.openRadio, originalOpen);
    const invoke = (text: string) => {
      draft = text;
      chat.sendMessage();
    };
    invoke('/radiobridge https://example.com/');
    assert.equal(storage.size, 0);
    assert.match(notes.at(-1)!, /Usage: \/radiobridge/);
    const endpoint = 'http://127.0.0.1:12345/' + 'a'.repeat(64);
    invoke('/radiobridge ' + endpoint);
    assert.equal(storage.get('radio.bridge'), endpoint);
    assert.equal(draft, '');
    assert.equal(intervals, 1);
    invoke('/invitetoradio @Nobody');
    assert.match(notes.at(-1)!, /Wait until IPC is connected/);
    invoke('/radioinvite accept');
    assert.match(notes.at(-1)!, /Wait until IPC is connected/);
    invoke('ordinary chat');
    invoke('/radioactive');
    assert.equal(ordinary, 2);
    assert.equal(
      notes.some((note) => note.includes(endpoint)),
      false,
    );
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
    await rm(temporary, { recursive: true, force: true });
    Object.assign(globalThis, { window: priorWindow, document: priorDocument });
  }
  assert.equal(chat.openRadio, originalOpen);
});
