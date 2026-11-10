import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArtifactContextPopup } from '../src/artifacts/ArtifactContextPopup';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';
import { Text } from './fixtures/NativeGame';

test('artifact context menu uses source geometry and requires a matching noncancelled row press', (t) => {
  const bitmap = bitmapRendererFixture('verdana16_bitmap');
  t.after(bitmap.cleanup);
  const Popup = createArtifactContextPopup((name) =>
    name === 'starling.text.TextField' ? Text : bitmap.resolve(name),
  );
  const popup = new Popup();
  t.after(() => popup.dispose());
  const artifact = { id: 'test', revealed: false };
  popup.showFor(artifact, 660, 510, 665, 520);
  assert.equal(popup.get_x(), 475);
  assert.equal(popup.get_y(), 441);
  assert.equal(popup.get_width(), 190);
  assert.equal(popup.get_height(), 66);
  assert.equal(popup.share.text, 'Reveal to share');
  const actions: string[] = [];
  for (const type of ['artifactShareContextFavorite', 'artifactShareContextShare'])
    popup.addEventListener(type, (event: any) => {
      assert.equal(popup.isOpen, false);
      assert.equal(event.data, artifact);
      actions.push(type);
    });
  const touch = (phase: string, y: number, cancelled = false) =>
    popup.dispatch({
      type: 'touch',
      target: popup,
      currentTarget: popup,
      setCurrentTarget() {},
      stopImmediatePropagation() {},
      getTouch: () => ({
        phase,
        cancelled,
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
  assert.equal(popup.favorite.text, 'Unfavorite');
  assert.equal(popup.share.text, 'Share on Chat...');
  touch('began', 15);
  touch('ended', 15);
  assert.equal(actions[1], 'artifactShareContextShare');
});
