import assert from 'node:assert/strict';
import test from 'node:test';
import { DualSenseHID, type ControllerHIDDevice } from '../src/controller/DualSenseHID';
import type { DualSenseOutput } from '../src/controller/DualSenseReport';

function device() {
  const writes: Uint8Array[] = [];
  const result: ControllerHIDDevice = {
    vendorId: 0x054c,
    productId: 0x0ce6,
    productName: 'DualSense',
    opened: false,
    collections: [{ usage: 5, usagePage: 1, outputReports: [{ reportId: 2 }], children: [] }],
    async open() {
      this.opened = true;
    },
    async close() {
      this.opened = false;
    },
    async sendReport(_id, data) {
      writes.push(data.slice());
    },
  };
  return { result, writes };
}
const output: DualSenseOutput = {
  left: { kind: 'off' },
  right: { kind: 'weapon', start: 2, end: 6, strength: 1 },
  weak: 0.5,
  strong: 1,
};

test('HID closes only after neutral motors/triggers and LED release are written', async () => {
  const { result, writes } = device();
  const hid = new DualSenseHID((error) => {
    throw error;
  });
  await hid.connect({
    async requestDevice() {
      return [result];
    },
  });
  assert.equal(hid.connected, true);
  hid.update(output);
  await hid.dispose();
  const final = writes.at(-1)!;
  assert.equal(final[2], 0);
  assert.equal(final[3], 0);
  assert.equal(final[10], 5);
  assert.equal(final[21], 5);
  assert.equal(final[1] & 8, 8);
  assert.equal(result.opened, false);
  assert.equal(hid.connected, false);
});

test('a picker resolving after plugin disposal never opens its device', async () => {
  const { result } = device();
  let resolve!: (devices: ControllerHIDDevice[]) => void;
  const hid = new DualSenseHID((error) => {
    throw error;
  });
  const connect = hid.connect({
    requestDevice() {
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  await hid.dispose();
  resolve([result]);
  await connect;
  assert.equal(result.opened, false);
});
