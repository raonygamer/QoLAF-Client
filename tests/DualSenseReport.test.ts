import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crc32,
  encodeDualSenseReport,
  encodeTrigger,
  type DualSenseOutput,
} from '../src/controller/DualSenseReport';

const output: DualSenseOutput = {
  left: { kind: 'off' },
  right: { kind: 'weapon', start: 2, end: 6, strength: 1 },
  weak: 0,
  strong: 0,
  light: [255, 32, 64],
  population: 99,
};

test('weapon and vibration trigger reports match documented zone encoding', () => {
  assert.deepEqual(
    Array.from(encodeTrigger(output.right)),
    [0x25, 0x44, 0, 7, 0, 0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    Array.from(encodeTrigger({ kind: 'vibration', start: 9, strength: 1, frequency: 20 })),
    [0x26, 0, 2, 0, 0, 0, 0x38, 0, 0, 20, 0],
  );
  assert.equal(encodeTrigger({ kind: 'resistance', start: 0, strength: 0 })[0], 0x05);
});

test('USB frame targets triggers and optional LEDs without changing microphone settings', () => {
  const { id, data } = encodeDualSenseReport(output, false);
  assert.equal(id, 2);
  assert.equal(data.length, 47);
  assert.equal(data[0], 15);
  assert.equal(data[1], 0x14);
  assert.deepEqual(Array.from(data.slice(8, 10)), [0, 0]);
  assert.equal(data[10], 0x25);
  assert.equal(data[21], 0x05);
  assert.equal(data[43], 0x1f);
  assert.deepEqual(Array.from(data.slice(44)), [255, 32, 64]);
});

test('Bluetooth wraps common payload and signs report ID with CRC32', () => {
  const usb = encodeDualSenseReport(output, false);
  const bt = encodeDualSenseReport(output, true, 19);
  assert.equal(bt.id, 0x31);
  assert.equal(bt.data.length, 77);
  assert.deepEqual(Array.from(bt.data.slice(0, 2)), [0x30, 0x10]);
  assert.deepEqual(bt.data.slice(2, 49), usb.data);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(
    new DataView(bt.data.buffer).getUint32(73, true),
    crc32(new Uint8Array([0xa2, 0x31, ...bt.data.slice(0, 73)])),
  );
});

test('disabled lighting has no LED control flags and population patterns cap at five', () => {
  assert.equal(
    encodeDualSenseReport(
      { left: { kind: 'off' }, right: { kind: 'off' }, weak: 0, strong: 0 },
      false,
    ).data[1],
    0,
  );
  for (let count = 0; count <= 7; count++) {
    const bits = encodeDualSenseReport({ ...output, population: count }, false).data[43];
    assert.equal(bits.toString(2).split('1').length - 1, Math.min(count, 5));
  }
});
