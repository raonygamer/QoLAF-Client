import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { installControllerHID } = createRequire(import.meta.url)(
  '../scripts/steam/ControllerHID.cjs',
);

test('Electron accepts trusted HID checks, asks before granting, persists grants and handles revocation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'qolaf-hid-'));
  const url = 'https://raony.dev/astroflux/game.html';
  const frame = { url };
  const contents = { getURL: () => url, mainFrame: frame };
  const window = { webContents: contents };
  const device = {
    vendorId: 0x054c,
    productId: 0x0ce6,
    name: 'DualSense',
    serialNumber: 'test',
    deviceId: 'device',
  };
  type Details = { origin: string; deviceType: string; device: typeof device };
  let check!: (contents: object | null, permission: string, origin: string) => boolean;
  let permission!: (details: Details) => boolean;
  const listeners = new Map<string, Function>();
  const session = {
    setPermissionCheckHandler(callback: typeof check) {
      check = callback;
    },
    setPermissionRequestHandler() {},
    setDevicePermissionHandler(callback: typeof permission) {
      permission = callback;
    },
    on(name: string, callback: Function) {
      listeners.set(name, callback);
    },
  };
  const dialog = { showMessageBox: async () => ({ response: 1 }) };
  const setup = () =>
    installControllerHID(
      session,
      dialog,
      () => window,
      (value: string) => value === url,
      join(directory, 'grants.json'),
    );
  try {
    setup();
    assert.equal(check(null, 'hid', 'https://raony.dev/'), true);
    assert.equal(check(contents, 'camera', 'https://raony.dev'), false);
    assert.equal(check(contents, 'hid', 'https://example.com'), false);
    const details = { origin: 'https://raony.dev', deviceType: 'hid', device };
    assert.equal(permission(details), false);
    const selected = await new Promise((resolve) =>
      listeners.get('select-hid-device')!(
        { preventDefault() {} },
        { frame, deviceList: [device] },
        resolve,
      ),
    );
    assert.equal(selected, 'device');
    assert.equal(permission(details), true);
    setup();
    assert.equal(permission(details), true);
    listeners.get('hid-device-revoked')!({}, details);
    assert.equal(permission(details), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
