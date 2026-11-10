import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactFavorites } from '../src/artifacts/ArtifactFavorites';
import { installArtifactRecycleProtection } from '../src/artifacts/ArtifactRecycleProtection';
// @ts-expect-error production dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('favorites remain account-scoped, persist and work when browser storage is unavailable', () => {
  let saved: any = {};
  const storage: any = {
    get: () => saved,
    set: (_key: string, value: any) => (saved = structuredClone(value)),
  };
  const favorites = new ArtifactFavorites(storage);
  favorites.setFavorite('one', '__proto__', true);
  assert.equal(favorites.isFavorite('one', '__proto__'), true);
  assert.equal(favorites.isFavorite('two', '__proto__'), false);
  assert.equal(new ArtifactFavorites(storage).isFavorite('one', '__proto__'), true);
  favorites.setFavorite('one', '__proto__', false);
  assert.equal(favorites.isFavorite('one', '__proto__'), false);
  const disabled = new ArtifactFavorites({
    get() {
      throw Error();
    },
    set() {
      throw Error();
    },
  });
  disabled.setFavorite('one', 'artifact', true);
  assert.equal(disabled.isFavorite('one', 'artifact'), true);
});

test('favorite recycle guards exclude protected items before selection and native submission', () => {
  const favorites = new ArtifactFavorites({ get: (_key, fallback) => fallback, set() {} });
  favorites.setFavorite('player', 'favorite', true);
  const p = { id: 'player' };
  class Box {
    p = p;
    recycleMode = true;
    frame = { color: 6513507 };
    toolTip = {
      text: '',
      set_text(text: string) {
        this.text = text;
      },
    };
    constructor(public a: any) {}
    setNotSelected() {
      this.frame.color = 6513507;
    }
    setSelectedForRecycle() {
      this.frame.color = 12203572;
    }
    toggleRecycle() {
      this.setSelectedForRecycle();
    }
    onClick() {
      this.toggleRecycle();
    }
    addToolTip() {
      this.toolTip.set_text('native');
    }
    isUsedInSetup() {
      return false;
    }
  }
  const button = () => ({
    enabled: false,
    visible: true,
    set_enabled(value: boolean) {
      this.enabled = value;
    },
  });
  class Overview {
    p = p;
    markedForRecycle: any[] = [];
    cargoBoxes = [
      new Box({ id: 'favorite', upgraded: 0 }),
      ...Array.from({ length: 45 }, (_, i) => new Box({ id: String(i), upgraded: 0 })),
    ];
    cargoContainer = { scrollToPosition() {} };
    selectAllRecycleButton = button();
    recycleButton = button();
    toggleRecycleButton = button();
    cancelRecycleButton = button();
    g = { myCargo: { isFull: false } };
    artifactRecyclePending = false;
    submissions: string[][] = [];
    onRecycleSelect(event: any) {
      this.markedForRecycle.push(event.target.a);
    }
    selectAllForRecycle() {}
    toggleRecycle() {
      this.markedForRecycle.length = 0;
    }
    onRecycle() {
      this.submissions.push(this.markedForRecycle.map((a) => a.id));
    }
    onRecycleMessage() {}
  }
  const classes: any = {
    'core.artifact.ArtifactCargoBox': Box,
    'core.artifact.ArtifactOverview': Overview,
  };
  const hooks = new Hooks();
  const api: any = { cls: (name: string) => classes[name] };
  for (const type of ['before', 'around', 'after'])
    api[type] = (obj: any, key: string, fn: Function) => hooks.add(obj, key, type, fn);
  installArtifactRecycleProtection(api, favorites);
  const view = new Overview(),
    box = view.cargoBoxes[0];
  box.frame.color = 12203572;
  box.onClick();
  assert.equal(box.frame.color, 6513507);
  box.frame.color = 123;
  box.toggleRecycle();
  assert.equal(box.frame.color, 123, 'upgrade selection is not cleared');
  box.addToolTip();
  assert.match(box.toolTip.text, /unfavorite/);
  view.onRecycleSelect({ target: box });
  assert.equal(view.markedForRecycle.length, 0);
  view.selectAllForRecycle();
  assert.equal(view.markedForRecycle.length, 40);
  assert.ok(view.markedForRecycle.every((a) => a.id !== 'favorite'));
  view.markedForRecycle.push(box.a);
  view.onRecycle();
  assert.equal(view.submissions.length, 1);
  assert.equal(view.submissions[0].length, 40);
  assert.equal(view.artifactRecyclePending, true);
  view.toggleRecycle();
  view.selectAllForRecycle();
  view.onRecycle();
  assert.equal(view.markedForRecycle.length, 40);
  assert.equal(view.submissions.length, 1);
  view.onRecycleMessage();
  assert.equal(view.artifactRecyclePending, false);
});
