import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeArtifactFavorites } from '../src/artifacts/NativeArtifactFavorites';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';
// @ts-expect-error production dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('favorite menu toggles source outline, prunes recycle selection and drafts sharing only after closing menu', async (t) => {
  const bitmap = bitmapRendererFixture();
  t.after(bitmap.cleanup);
  const cleanup: Function[] = [];
  t.after(() => cleanup.reverse().forEach((fn) => fn()));
  const hooks = new Hooks();
  const artifact = { id: 'a', revealed: true };
  const player = { id: 'p', getArtifactById: (id: string) => (id === 'a' ? artifact : null) };
  class Box extends bitmap.Sprite {
    a: any = artifact;
    p = player;
    frame: any;
    constructor() {
      super();
      this.frame = new (bitmap.resolve('starling.display.Quad'))(32, 32, 6513507);
    }
    update() {}
    addToolTip() {}
    setArtifact() {}
    onClick() {}
    toggleRecycle() {}
    setSelectedForRecycle() {}
    setNotSelected() {
      this.frame.color = 6513507;
    }
  }
  const actions: any[] = [];
  const game = {
    me: player,
    chatInput: { insertArtifactLink: (...args: any[]) => actions.push(['draft', ...args]) },
    showMessageDialog: (message: string) => actions.push(['message', message]),
  };
  class Overview extends bitmap.Sprite {
    p = player;
    g = game;
    cargoBoxes = [new Box()];
    activeSlots: any[] = [];
    markedForRecycle = [artifact];
    artifactRecyclePending = false;
    drawComponents() {}
    onRecycleSelect() {}
    selectAllForRecycle() {}
    toggleRecycle() {}
    onRecycle() {}
    onRecycleMessage() {}
  }
  const classes: any = {
    'core.artifact.ArtifactOverview': Overview,
    'core.artifact.ArtifactCargoBox': Box,
    'core.artifact.ArtifactBox': class extends Box {},
    'core.hud.components.ToolTip': { disposeType() {} },
  };
  let saved: any = {};
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
    storage: { get: () => saved, set: (_key: string, value: any) => (saved = value) },
  };
  for (const type of ['before', 'after', 'around'])
    api[type] = (target: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, type, fn));
  installNativeArtifactFavorites(api, (name) =>
    name === 'starling.text.TextField' ? Text : bitmap.resolve(name),
  );
  const view = new Overview();
  const parent: any = new bitmap.Sprite();
  parent.sm = { parent: { closeMenu: () => actions.push(['close']) } };
  parent.addChild(view);
  view.drawComponents();
  const popup: any = view.getChildAt(0);
  view.cargoBoxes[0].frame.color = 12203572;
  popup.dispatchEventWith('artifactShareContextFavorite', false, artifact);
  assert.equal(saved['account:p']['artifact:a'], true);
  assert.equal(view.markedForRecycle.length, 0);
  assert.equal(view.cargoBoxes[0].frame.color, 6513507);
  const marker: any = view.cargoBoxes[0].getChildAt(0);
  assert.equal(marker.touchable, false);
  assert.equal(marker.get_numChildren(), 4);
  assert.equal(marker.getChildAt(0).color, 0xffcc55);
  assert.equal(marker.getChildAt(0).get_x(), 3);
  assert.equal(marker.getChildAt(0).get_width(), 26);
  view.artifactRecyclePending = true;
  popup.dispatchEventWith('artifactShareContextFavorite', false, artifact);
  assert.equal(saved['account:p']['artifact:a'], true);
  assert.equal(actions[0][0], 'message');
  view.artifactRecyclePending = false;
  popup.dispatchEventWith('artifactShareContextFavorite', false, { ...artifact });
  assert.equal(saved['account:p']['artifact:a'], true, 'stale identity is ignored');
  popup.dispatchEventWith('artifactShareContextFavorite', false, artifact);
  assert.equal(marker.visible, false);
  popup.dispatchEventWith('artifactShareContextShare', false, artifact);
  await Promise.resolve();
  assert.deepEqual(actions.slice(-2), [['close'], ['draft', 'p', artifact]]);
  view.dispose();
  assert.equal(popup.disposed, true);
});
