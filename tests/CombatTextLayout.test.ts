import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindGameClasses } from '../src/game/Bindings';
import { installCombatTextLayout } from '../src/rendering/CombatTextLayout';
import { Display, Text } from './fixtures/NativeGame';
import type { Raw } from '../src/api/Types';
// @ts-expect-error inspected upstream implementation
import makeTextHandler from './fixtures/UpstreamTextHandler.js';
// @ts-expect-error actual host hooks
import { Hooks } from './fixtures/HostCore.js';

test('combat layout uses the source atlas before measuring and disposes the complete pool', () => {
  class Particle extends Text {
    speed = { x: 0, y: 0 };
    measurements = 0;
    measuredFonts: string[] = [];
    resets: boolean[] = [];
    get_textBounds() {
      this.measurements++;
      this.measuredFonts.push(this.format.font);
      return { width: (this.text.length * this.format.size) / 2, height: this.format.size };
    }
    set_wordWrap(value: boolean) {
      this.values.wordWrap = value;
    }
    set_pivotX(value: number) {
      this.values.pivotX = value;
    }
    reset(release = true) {
      this.resets.push(release);
    }
    set_text(value: string) {
      super.set_text(value);
      this.set_width(this.get_textBounds().width + 4);
      return value;
    }
  }
  const Handler = makeTextHandler();
  const first = new Particle(),
    second = new Particle();
  const game = Object.assign(new Display(), {
    textManager: { inactiveTexts: [second, first] },
    canvasTexts: new Display(),
  });
  const handler = new Handler(game);
  const classes: Raw = {
    'core.text.TextHandler': Handler,
    'core.text.TextParticle': Particle,
    'starling.text.TextField': Text,
  };
  const hooks = new Hooks(),
    cleanups: Array<() => void> = [];
  const api = {
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    cls: (name: string) => classes[name] ?? { prototype: {} },
    around: (target: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
  } as any;
  bindGameClasses(api);
  installCombatTextLayout(api);
  const add = (alignment: string, fixed = false) =>
    handler.add(
      '12345',
      { x: 10, y: 20 },
      { x: 5, y: -40 },
      750.5,
      0x123456,
      20,
      fixed,
      alignment,
      'add',
      true,
    );
  try {
    assert.equal(add('right'), first);
    assert.deepEqual(first.measuredFonts, ['DAIDRR_COMBAT']);
    assert.equal(first.get_width(), 95);
    assert.equal(first.get_height(), 62);
    assert.equal(first.values.pivotX, 95);
    assert.equal(first.values.wordWrap, false);
    assert.equal((first as Raw).ttl, 750.5);
    assert.equal((first as Raw).baseScale, 1);
    assert.equal((first as Raw).createdZoom, 0);
    first.set_text('67890');
    assert.equal(first.measurements, 1, 'updates must not trigger native autoWidth');
    assert.equal(add('center', true), second);
    assert.equal(second.values.pivotX, 47.5);
    assert.equal(second.parent, game);
    assert.equal(add('left'), first, 'pool exhaustion steals the oldest particle');
    assert.equal(first.measurements, 2, 'stealing skips empty-text composition');
    assert.equal(first.values.pivotX, 0);
    handler.remove(second, handler.texts.indexOf(second));
    assert.equal(second.text, '');
    assert.equal(second.measurements, 2, 'returning to pool releases old geometry');
    const inactive = game.textManager.inactiveTexts;
    handler.dispose();
    assert.equal(first.disposed, true);
    assert.equal(second.disposed, true);
    assert.equal(inactive.length, 0);
    assert.equal(game.children.length, 0);
    assert.equal(game.canvasTexts.children.length, 0);
    handler.dispose();
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});

test('handler initialization extends the native pool to the original 80 particles only once', () => {
  class Particle {
    static created = 0;
    static disposed = 0;
    constructor(
      public id: number,
      public g: Raw,
    ) {
      Particle.created++;
    }
    set_text() {}
    reset() {}
    removeFromParent() {}
    dispose() {
      Particle.disposed++;
    }
  }
  const Handler = makeTextHandler();
  class Manager {
    inactiveTexts: Particle[];
    textHandler: Raw | null = null;
    constructor(public g: Raw) {
      this.inactiveTexts = Array.from({ length: 40 }, (_, id) => new Particle(id, g));
      g.textManager = this;
    }
    loadHandlers() {
      this.textHandler = new Handler(this.g);
    }
    dispose() {
      this.textHandler!.dispose();
    }
  }
  const classes: Raw = {
    'core.text.TextHandler': Handler,
    'core.text.TextParticle': Particle,
    'core.text.TextManager': Manager,
    'starling.text.TextField': Text,
  };
  const hooks = new Hooks(),
    cleanups: Array<() => void> = [];
  const api = {
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    cls: (name: string) => classes[name] ?? { prototype: {} },
    around: (object: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'around', fn)),
    before: (object: Raw, key: string, fn: Function) =>
      cleanups.push(hooks.add(object, key, 'before', fn)),
  } as any;
  bindGameClasses(api);
  installCombatTextLayout(api);
  try {
    const manager = new Manager({});
    manager.loadHandlers();
    assert.equal(Particle.created, 80);
    assert.equal(manager.inactiveTexts.length, 80);
    assert.equal(manager.textHandler!.inactiveTexts, manager.inactiveTexts);
    assert.deepEqual(
      manager.inactiveTexts.map((p) => p.id),
      Array.from({ length: 80 }, (_, i) => i),
    );
    manager.loadHandlers();
    assert.equal(Particle.created, 80);
    manager.dispose();
    assert.equal(Particle.disposed, 80);
    assert.equal(manager.textHandler, null);
    assert.equal(manager.inactiveTexts, null);
    manager.dispose();
    assert.equal(Particle.disposed, 80, 'repeated teardown must not dispose particles twice');
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});
