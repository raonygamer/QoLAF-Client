import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeDualSenseInput } from '../src/controller/DualSenseInput';

for (const [reportId, length, offset, basic] of [
  [1, 63, 0, false],
  [1, 9, 0, true],
  [0x31, 77, 1, false],
] as const) {
  test(`DualSense input ${reportId}/${length} maps sticks, analog triggers, face buttons and D-pad`, () => {
    const bytes = new Uint8Array(length);
    bytes.set([128, 0, 255, 128], offset);
    bytes[offset + (basic ? 4 : 7)] = 0x21; // Cross + diagonal up/right
    bytes[offset + (basic ? 5 : 8)] = 0x41; // L1 + L3
    bytes[offset + (basic ? 6 : 9)] = 2; // touchpad
    bytes[offset + (basic ? 7 : 4)] = 0;
    bytes[offset + (basic ? 8 : 5)] = 255;
    const sample = decodeDualSenseInput(reportId, new DataView(bytes.buffer))!;
    assert.deepEqual(sample.axes, [0, -1, 1, 0]);
    assert.deepEqual(
      sample.buttons.flatMap((button, index) => (button.value === 1 ? [index] : [])),
      [0, 4, 7, 10, 12, 15, 17],
    );
    assert.equal(sample.buttons[6].value, 0);
  });
}
test('ignores unknown or incomplete reports instead of latching bad input', () => {
  assert.equal(decodeDualSenseInput(1, new DataView(new ArrayBuffer(8))), null);
  assert.equal(decodeDualSenseInput(5, new DataView(new ArrayBuffer(63))), null);
});
