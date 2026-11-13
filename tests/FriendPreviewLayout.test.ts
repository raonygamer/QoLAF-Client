import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type Sprite } from '../src/game/Bindings';
import { fitFriendPreviews } from '../src/hud/FriendPreviewLayout';
import { Display } from './fixtures/NativeGame';

class Preview extends Display {
  pivotX = 0;
  pivotY = 0;
  get_pivotX() {
    return this.pivotX;
  }
  get_pivotY() {
    return this.pivotY;
  }
  set_pivotX(value: number) {
    return (this.pivotX = value);
  }
  set_pivotY(value: number) {
    return (this.pivotY = value);
  }
}

test('friend previews center and fit both orientations without enlarging small ships; unload restores geometry', () => {
  bindGameClasses({
    cls: (name: string) => (name === 'starling.display.MovieClip' ? Preview : {}),
  } as unknown as API);
  for (const [width, height, scale] of [
    [100, 20, 0.4],
    [20, 100, 0.4],
    [10, 20, 1],
    [80, 80, 0.5],
  ]) {
    const box = new Display();
    const clip = new Preview();
    clip.set_width(width);
    clip.set_height(height);
    clip.set_x(-width / 2);
    box.addChild(clip);
    const unrelated = new Display();
    unrelated.set_x(50);
    box.addChild(unrelated);
    const restore = fitFriendPreviews([box as unknown as Sprite]);
    assert.equal(clip.get_pivotX(), width / 2);
    assert.equal(clip.get_pivotY(), height / 2);
    assert.equal(clip.get_scaleX(), scale);
    assert.equal(clip.get_scaleY(), scale);
    assert.equal(clip.get_x(), 0);
    assert.equal(clip.get_y(), 20);
    assert.equal(unrelated.get_x(), 50);
    restore();
    assert.equal(clip.get_x(), -width / 2);
    assert.equal(clip.get_y(), 0);
    assert.equal(clip.get_scaleX(), 1);
    assert.equal(clip.get_scaleY(), 1);
    assert.equal(clip.get_pivotX(), 0);
    assert.equal(clip.get_pivotY(), 0);
    clip.set_x(123);
    restore();
    assert.equal(clip.get_x(), 123, 'cleanup is idempotent');
  }
});
