import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientHelpWelcomeState } from '../src/dialogs/ClientHelpWelcomeState';

test('first-time welcome persists pending until a deliberate dismissal', () => {
  const data: Record<string, unknown> = {};
  let saves = 0;
  const storage = { get_data: () => data, flush: () => saves++ };
  const first = new ClientHelpWelcomeState();
  first.initialize(storage);
  assert.equal(first.pending, true);
  const reconnected = new ClientHelpWelcomeState();
  reconnected.initialize(storage);
  assert.equal(reconnected.pending, true);
  reconnected.dismiss(storage);
  const reopened = new ClientHelpWelcomeState();
  reopened.initialize(storage);
  assert.equal(reopened.pending, false);
  assert.equal(saves, 2);
});

test('existing profiles skip welcome while an interrupted pending invitation remains pending', () => {
  for (const saved of [undefined, 'pending', 'dismissed']) {
    const state = new ClientHelpWelcomeState();
    const data = { qolafLastSeenClientVersion: 122, qolafClientHelpWelcomeState: saved };
    state.initialize({ data, flush() {} });
    assert.equal(state.pending, saved === 'pending');
  }
});

test('storage failures do not repeat a dismissed welcome across room changes', () => {
  const state = new ClientHelpWelcomeState();
  const unavailable = {
    get_data() {
      throw Error('denied');
    },
    flush() {},
  };
  state.initialize(unavailable);
  assert.equal(state.pending, true);
  state.dismiss(unavailable);
  state.initialize(unavailable);
  assert.equal(state.pending, false);
});

test('welcome waits for modals and reconnects, survives teardown, and opens help once', async () => {
  const { installNativeClientWelcome } = await import('../src/dialogs/NativeClientWelcome');
  class NativePopup {
    get_visible() {
      return true;
    }
    get_alpha() {
      return 1;
    }
    textField = {
      width: 0,
      set_width(value: number) {
        this.width = value;
      },
    };
    set_text() {}
    get_parent() {
      return this.parent;
    }
    confirmButton = { callback: null };
    closeButton = { callback: null };
    parent: object | null = null;
    listeners = new Map<string, Function>();
    disposed = false;
    addEventListener(name: string, fn: Function) {
      this.listeners.set(name, fn);
    }
    removeEventListener(name: string) {
      this.listeners.delete(name);
    }
    removeEventListeners() {
      this.listeners.clear();
    }
    dispose() {
      this.disposed = true;
    }
    emit(name: string) {
      this.listeners.get(name)?.({ currentTarget: this });
    }
  }
  const storage = { data: {}, flush() {} };
  const makeRoom = () => {
    let poll: Function = () => {};
    let stopped = false;
    const cleanup: Function[] = [];
    const overlays: NativePopup[] = [];
    const game: any = {
      sharedObj: storage,
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
      overlay: { get_numChildren: () => 0 },
      blockHotkeys: true,
      addChildToOverlay(popup: NativePopup) {
        popup.parent = this;
        overlays.push(popup);
      },
      removeChildFromOverlay(popup: NativePopup) {
        popup.parent = null;
        popup.dispose();
      },
    };
    const api: any = {
      game,
      defer: (fn: Function) => cleanup.push(fn),
      interval(fn: Function) {
        poll = fn;
        return () => {
          stopped = true;
        };
      },
    };
    let opened = 0;
    let waitingForRelease = false;
    bindGameClasses({ cls: () => NativePopup } as unknown as API);
    const dismiss = installNativeClientWelcome(
      api,
      game,
      () => NativePopup,
      () => opened++,
      () => waitingForRelease,
    );
    return {
      game,
      overlays,
      dismiss,
      cleanup,
      tick: () => !stopped && poll(),
      opened: () => opened,
      waitForRelease: (value: boolean) => {
        waitingForRelease = value;
      },
    };
  };
  const first = makeRoom();
  first.tick();
  assert.equal(first.overlays.length, 0);
  first.game.blockHotkeys = false;
  first.game.isRecoveringGameConnection = true;
  first.tick();
  assert.equal(first.overlays.length, 0);
  first.game.isRecoveringGameConnection = false;
  const sale = new NativePopup();
  first.game.overlay = { get_numChildren: () => 1, getChildAt: () => sale };
  first.tick();
  assert.equal(first.overlays.length, 0);
  first.game.overlay = { get_numChildren: () => 0 };
  first.waitForRelease(true);
  first.tick();
  assert.equal(first.overlays.length, 0, 'welcome cannot race the pending release popup');
  first.waitForRelease(false);
  first.tick();
  first.tick();
  assert.equal(first.overlays.length, 1);
  first.game.isLeaving = true;
  first.cleanup.forEach((fn) => fn());
  assert.equal(first.overlays[0].disposed, true);
  const second = makeRoom();
  second.game.blockHotkeys = false;
  second.tick();
  assert.equal(second.overlays.length, 1);
  second.overlays[0].emit('accept');
  assert.equal(second.opened(), 1);
  assert.equal(second.overlays[0].disposed, true);
  second.tick();
  assert.equal(second.overlays.length, 1);
  second.cleanup.forEach((fn) => fn());
  const third = makeRoom();
  third.game.blockHotkeys = false;
  third.tick();
  assert.equal(third.overlays.length, 0);
  third.cleanup.forEach((fn) => fn());
});

test('browser welcome dismissal is restored from host plugin storage after reload', async () => {
  const { createClientWelcomeStorage } = await import('../src/dialogs/NativeClientWelcome');
  const values = new Map<string, unknown>();
  const api: any = {
    storage: {
      get: (key: string, fallback: unknown) => structuredClone(values.get(key) ?? fallback),
      set: (key: string, value: unknown) => values.set(key, structuredClone(value)),
    },
  };
  const initial = new ClientHelpWelcomeState();
  const storage = createClientWelcomeStorage(api);
  initial.initialize(storage);
  initial.dismiss(storage);
  const reloaded = new ClientHelpWelcomeState();
  reloaded.initialize(createClientWelcomeStorage(api));
  assert.equal(reloaded.pending, false);
});
