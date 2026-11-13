import assert from 'node:assert/strict';
import { test } from 'node:test';
import { separateHudNotices } from '../src/hud/NoticeLayout';

test('native notice anchors remain unchanged at 720p and separate at 1080p', () => {
  const bounds = (height: number) => [
    { x: 100, y: height / 2 + 180, width: 400, height: 30 },
    { x: 140, y: height - height / 3, width: 320, height: 18 },
  ];
  assert.deepEqual(separateHudNotices(bounds(720)), [540, 480]);
  assert.deepEqual(separateHudNotices(bounds(1080)), [720, 696]);
  assert.deepEqual(
    separateHudNotices([bounds(1080)[1]]),
    [720],
    'hidden safe-zone notice cannot move landing prompt',
  );
});

test('safe-zone, repair and landing text cannot collide across stage and font heights', () => {
  for (let stage = 600; stage <= 2160; stage += 30) {
    for (const fontHeight of [16, 26, 40, 80]) {
      const notices = [
        { x: 100, y: stage / 2 + 180, width: 400, height: fontHeight },
        { x: 120, y: stage / 2 + 210, width: 360, height: fontHeight },
        { x: 140, y: stage - stage / 3, width: 320, height: fontHeight },
      ];
      const ys = separateHudNotices(notices);
      for (let first = 0; first < ys.length; first++)
        for (let second = first + 1; second < ys.length; second++)
          assert.ok(
            ys[first] + fontHeight + 6 <= ys[second] || ys[second] + fontHeight + 6 <= ys[first],
          );
    }
  }
  assert.deepEqual(
    separateHudNotices([
      { x: 0, y: 10, width: 20, height: 30 },
      { x: 100, y: 10, width: 20, height: 30 },
    ]),
    [10, 10],
    'horizontally separate text needs no vertical adjustment',
  );
});
