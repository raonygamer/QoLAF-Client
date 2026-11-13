import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArtifactContextPopup } from '../src/artifacts/ArtifactContextPopup';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import type { Artifact } from '../src/game/Bindings';
import { Display, Stage, Text } from './fixtures/NativeGame';

test('artifact context menu uses source geometry and requires a matching noncancelled row press', (t) => {
  const bitmap = bitmapRendererFixture('verdana16_bitmap');
  t.after(bitmap.cleanup);
  const Popup = createArtifactContextPopup();
  const popup = new Popup();
  t.after(() => popup.dispose());
  const artifact = { id: 'test', revealed: false } as Artifact;
  popup.showFor(artifact, 660, 510, 665, 520);
  assert.equal(popup.get_x(), 475);
  assert.equal(popup.get_y(), 441);
  assert.equal(popup.get_width(), 190);
  assert.equal(popup.get_height(), 66);
  assert.equal((popup.getChildAt(2) as unknown as Text).get_text(), 'Reveal to share');
  const actions: string[] = [];
  for (const type of ['artifactShareContextFavorite', 'artifactShareContextShare'])
    popup.addEventListener(type, (event: any) => {
      assert.equal(popup.isOpen, false);
      assert.equal(event.data, artifact);
      actions.push(type);
    });
  const touch = (phase: string, y: number, cancelled = false) =>
    (popup as unknown as Display).dispatch({
      type: 'touch',
      target: popup,
      currentTarget: popup,
      setCurrentTarget() {},
      stopImmediatePropagation() {},
      getTouch: () => ({
        get_phase: () => phase,
        get_cancelled: () => cancelled,
        getLocation: (_target: any, point: any) => Object.assign(point, { x: 30, y }),
      }),
    });
  touch('began', 15);
  touch('ended', 15);
  assert.deepEqual(actions, []);
  touch('began', 15);
  touch('ended', 48);
  assert.deepEqual(actions, []);
  touch('began', 48);
  touch('ended', 48, true);
  assert.deepEqual(actions, []);
  touch('began', 48);
  touch('ended', 48);
  assert.deepEqual(actions, ['artifactShareContextFavorite']);
  artifact.revealed = true;
  popup.showFor(artifact, 0, 0, 665, 520, true);
  assert.equal((popup.getChildAt(4) as unknown as Text).get_text(), 'Unfavorite');
  assert.equal((popup.getChildAt(2) as unknown as Text).get_text(), 'Share on Chat...');
  touch('began', 15);
  touch('ended', 15);
  assert.equal(actions[1], 'artifactShareContextShare');
});

test('artifact menu outside listener closes only on outside presses and detaches on removal', (t) => {
  const bitmap = bitmapRendererFixture();
  t.after(bitmap.cleanup);
  const Popup = createArtifactContextPopup();
  const popup = new Popup();
  t.after(() => popup.dispose());
  const stage = new Stage();
  stage.addChild(popup as unknown as Display);
  const artifact = { id: 'test', revealed: true } as Artifact;
  let closed = 0;
  popup.addEventListener('artifactShareContextClose', () => closed++);
  popup.showFor(artifact, 10, 10, 665, 520);
  popup.showFor(artifact, 20, 20, 665, 520);
  assert.equal(stage.listeners('touch').length, 1);
  const press = (target: Display) =>
    stage.dispatch({
      type: 'touch',
      target: stage,
      currentTarget: stage,
      setCurrentTarget() {},
      getTouch: () => ({ get_target: () => target }),
    });
  press(popup.getChildAt(2) as unknown as Display);
  assert.equal(popup.isOpen, true);
  press(new Display());
  assert.equal(popup.isOpen, false);
  assert.equal(closed, 1);
  assert.equal(stage.listeners('touch').length, 0);
  popup.showFor(artifact, 20, 20, 665, 520);
  popup.dispatchEventWith('removedFromStage');
  assert.equal(popup.isOpen, false);
  assert.equal(stage.listeners('touch').length, 0);
  assert.equal(closed, 1, 'removal silently closes the menu');
});
