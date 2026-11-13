import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientReleaseSequence } from '../src/dialogs/ClientReleaseSequence';
import { createClientHelpPopup } from '../src/dialogs/ClientHelpPopup';

function fixture(sequence = new ClientReleaseSequence(), version = '0.2.0-dev') {
  const saved = new Map<string, unknown>();
  const cleanups: (() => void)[] = [];
  let tick = () => {};
  let stopped = false;
  let opened = 0;
  let ready = true;
  class Modal {
    visible = true;
    get_visible() {
      return this.visible;
    }
  }
  const children: Modal[] = [];
  const game: any = {
    me: {},
    get_me() {
      return this.me;
    },
    get_isLeaving() {
      return this.isLeaving === true;
    },
    get_isRecoveringGameConnection() {
      return this.isRecoveringGameConnection === true;
    },
    overlay: { get_numChildren: () => children.length, getChildAt: (i: number) => children[i] },
  };
  const api: any = {
    game,
    cls: () => Modal,
    storage: {
      get: (key: string, fallback: unknown) => saved.get(key) ?? fallback,
      set: (key: string, value: unknown) => saved.set(key, value),
    },
    interval(fn: () => void) {
      tick = fn;
      return () => {
        stopped = true;
      };
    },
    defer(fn: () => void) {
      cleanups.push(fn);
    },
  };
  bindGameClasses(api);
  const show = sequence.install(api, game, version, () => {
    if (!ready) return false;
    opened++;
    game.blockHotkeys = true;
    return true;
  });
  return {
    api,
    game,
    saved,
    children,
    Modal,
    show,
    tick: () => {
      if (!stopped) tick();
    },
    dispose: () => cleanups.forEach((fn) => fn()),
    setReady: (value: boolean) => {
      ready = value;
    },
    get opened() {
      return opened;
    },
  };
}

test('release waits for Sale, connection recovery and a current playable game', () => {
  const f = fixture();
  f.game.blockHotkeys = true;
  f.tick();
  f.game.blockHotkeys = false;
  f.children.push(new f.Modal());
  f.tick();
  f.children.length = 0;
  f.game.isRecoveringGameConnection = true;
  f.tick();
  f.game.isRecoveringGameConnection = false;
  f.api.game = {};
  f.tick();
  f.api.game = f.game;
  f.game.me = null;
  f.tick();
  assert.equal(f.opened, 0);
  f.game.me = {};
  f.game.isLeaving = true;
  f.tick();
  assert.equal(f.opened, 0);
  f.game.isLeaving = false;
  f.tick();
  f.tick();
  assert.equal(f.opened, 1);
  assert.equal(f.game.blockHotkeys, true, 'welcome must wait until release modal closes');
  const restored = new ClientReleaseSequence();
  assert.equal(restored.hasSeen(f.api, '0.2.0-dev'), true);
  assert.equal(restored.hasSeen(f.api, '0.3.0'), false);
});

test('manual opening consumes automatic prompt; rejected opens and teardown do not', () => {
  const f = fixture();
  f.setReady(false);
  assert.equal(f.show(), false);
  f.tick();
  assert.equal(f.opened, 0);
  f.setReady(true);
  assert.equal(f.show(), true);
  f.tick();
  assert.equal(f.opened, 1);
  const abandoned = fixture();
  abandoned.dispose();
  abandoned.tick();
  assert.equal(abandoned.opened, 0);
  assert.equal(abandoned.saved.size, 0);
});

test('denied storage retains release state across rooms without suppressing future versions', () => {
  const sequence = new ClientReleaseSequence();
  const f = fixture(sequence);
  f.api.storage.get = () => {
    throw Error('denied');
  };
  f.api.storage.set = () => {
    throw Error('denied');
  };
  f.tick();
  assert.equal(f.opened, 1);
  assert.equal(sequence.hasSeen(f.api, '0.2.0-dev'), true);
  assert.equal(sequence.hasSeen(f.api, '0.3.0'), false);
  const next = fixture(sequence);
  next.tick();
  assert.equal(next.opened, 0);
});

test('help keeps source dimensions and fits tabs and Close within a short viewport after resizing', () => {
  const Popup = createClientHelpPopup(() => class {});
  const view: any = {
    stage: { stageWidth: 1879, stageHeight: 965 },
    content: {},
    box: {},
    closeButton: { width: 100, height: 30 },
    bgr: {},
  };
  const redraw = Popup.prototype.redraw;
  redraw.call(view);
  assert.equal(view.box.scaleX, 1);
  for (const [width, height] of [
    [1879, 415],
    [480, 640],
    [1879, 965],
  ]) {
    view.stage.stageWidth = width;
    view.stage.stageHeight = height;
    redraw.call(view);
    assert.ok(view.box.x >= 15);
    assert.ok(view.box.y >= 15);
    assert.ok(view.box.x + 720 * view.box.scaleX <= width - 15);
    assert.ok(view.box.y + (view.closeButton.y + 30) * view.box.scaleY <= height - 15);
  }
  assert.equal(view.box.scaleX, 1, 'restoring viewport must restore full-size bitmap text');
});
