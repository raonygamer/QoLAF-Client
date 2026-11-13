import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPlayerNameStyle } from '../src/ship/PlayerNameStyle';
import type { TextBitmap } from '../src/game/Bindings';

test('player labels use opaque normal-blended combat text and restore native styling', () => {
  let alpha = 0.8;
  let blend = 'add';
  let font = 'font13';
  let measurements = 0;
  const format = {
    get_font: () => font,
    set_font: (value: string) => {
      font = value;
    },
  };
  const text = {
    get_format: () => format,
    get_alpha: () => alpha,
    set_alpha: (value: number) => {
      alpha = value;
    },
    get_blendMode: () => blend,
    set_blendMode: (value: string) => {
      blend = value;
    },
    autoWidth: () => {
      measurements++;
    },
  } as unknown as TextBitmap;
  const restore = applyPlayerNameStyle(text);
  assert.deepEqual([alpha, blend, font, measurements], [1, 'normal', 'DAIDRR_COMBAT', 1]);
  restore();
  assert.deepEqual([alpha, blend, font, measurements], [0.8, 'add', 'font13', 2]);
});
