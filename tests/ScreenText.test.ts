import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installScreenText } from '../src/ui/ScreenText';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('native screen text hooks preserve lore timing, cancel owned work and restore on unload', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  class Filter {
    disposed = false;
    set_blurX(value: number) {
      return value;
    }
    dispose() {
      this.disposed = true;
    }
  }
  class Field {
    font = 'DAIDRR';
    get_format() {
      return {
        get_font: () => this.font,
        get_size: () => 16,
        set_font: (font: string) => {
          this.font = font;
        },
      };
    }
    _textArray: string[][] | null = [['x']];
    duration = 100;
    period = 10;
    caretIncrement = 1;
    randomCharAmount = 0;
    fadeOutDelay = 0;
    caretDelay = 10;
    paragraphReadTime = 10;
    pageReadTime = 30;
    paragraphInitTime = 10;
    newRowTime = 10;
    fadeOutTime = 20;
    glowFilter = null;
    filter: Filter | null = null;
    text = '';
    alpha = 1;
    nativeStarts = 0;
    disposed = false;
    CARET_SOUND = 'caret';
    events: string[] = [];
    completions: Array<() => void> = [];
    soundManager = {
      preCacheSound: (_key: string, complete: () => void) => this.completions.push(complete),
      play() {},
    };
    set_text(text: string) {
      this.text = text;
      return text;
    }
    set_alpha(alpha: number) {
      this.alpha = alpha;
      return alpha;
    }
    get_filter() {
      return this.filter;
    }
    set_filter(filter: Filter | null) {
      this.filter = filter;
      return filter;
    }
    toggleCaret(text: string) {
      this.text = text + '_';
    }
    randText() {
      return '';
    }
    resetStyle() {
      this.alpha = 1;
    }
    dispatchEventWith(event: string) {
      this.events.push(event);
    }
    start(_pages?: string[][], _adjust?: boolean) {
      this.nativeStarts++;
    }
    stop() {}
    play() {}
    doFadeOut() {}
    createFadeOutPage(_text: string) {
      return () => {};
    }
    onAnimationFinished() {}
    dispose() {
      this.disposed = true;
    }
  }
  class Lore {
    field = new Field();
    runLore(_page: number, pages: string[][]) {
      this.field.start(pages, false);
      this.field.pageReadTime = 180000;
    }
  }
  const classes: Record<string, unknown> = {
    'core.hud.components.ScreenTextField': Field,
    'core.states.gameStates.LandedLore': Lore,
    'starling.filters.BlurFilter': Filter,
  };
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around: (owner: object, key: string, callback: unknown) => {
      const off = hooks.add(owner, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
    before: (owner: object, key: string, callback: unknown) => {
      const off = hooks.add(owner, key, 'before', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installScreenText(api);
  const lore = new Lore();
  lore.runLore(0, [['x']]);
  lore.field.completions[0]();
  t.mock.timers.tick(10); // initial caret pause
  t.mock.timers.tick(10); // reveal one character
  t.mock.timers.tick(40); // native default page read would already have expired
  assert.deepEqual(lore.field.events, ['beforeFadeOut']);
  lore.field.stop();
  lore.field.doFadeOut();
  t.mock.timers.tick(20);
  assert.deepEqual(lore.field.events, ['beforeFadeOut', 'pageFinished']);
  const filter = lore.field.filter;
  assert.ok(filter);
  lore.field.dispose();
  assert.equal(filter.disposed, true);
  assert.equal(lore.field.disposed, true);
  assert.equal(lore.field.filter, null);
  const waiting = new Field();
  waiting.start();
  cleanups.reverse().forEach((off) => off());
  waiting.completions[0]();
  t.mock.timers.tick(10000);
  assert.deepEqual(waiting.events, []);
  waiting.start();
  assert.equal(waiting.nativeStarts, 1);
});
