'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Device grants are remembered only after the user chooses a controller.
function installControllerHID(session, dialog, getWindow, isGameUrl, grantsFile) {
  const originOf = value => { try { return new URL(value).origin; } catch { return ''; } };
  const allowedOrigin = value => ['https://raony.dev', 'https://astroflux.net', 'https://beta.astroflux.net'].includes(originOf(value));
  const supported = device => device.vendorId === 0x054c && [0x0ce6, 0x0df2].includes(device.productId);
  const identity = device => [device.vendorId, device.productId, device.serialNumber || device.name || device.productName || ''].join(':');
  let grants = [];
  try { const saved = JSON.parse(fs.readFileSync(grantsFile, 'utf8')); if (Array.isArray(saved)) grants = saved.filter(value => typeof value === 'string'); } catch {}
  const save = () => {
    if (!grantsFile) return;
    try { fs.mkdirSync(path.dirname(grantsFile), { recursive: true }); fs.writeFileSync(grantsFile, JSON.stringify(grants), { mode: 0o600 }); }
    catch (error) { console.warn('[QoLAF HID] Could not save device grant:', error.message); }
  };
  const trustedWindow = () => {
    const window = getWindow();
    return window && !window.isDestroyed?.() && isGameUrl(window.webContents.getURL()) ? window : null;
  };
  session.setPermissionCheckHandler((contents, permission, origin, details) => {
    const window = trustedWindow();
    // Older Electron versions can supply null webContents for a HID check.
    return permission === 'hid' && !!window && (!contents || contents === window.webContents) &&
      allowedOrigin(details?.securityOrigin || origin);
  });
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    const window = trustedWindow();
    callback(permission === 'hid' && !!window && contents === window.webContents &&
      allowedOrigin(details?.requestingUrl || contents.getURL()));
  });
  session.setDevicePermissionHandler(details =>
    details.deviceType === 'hid' && allowedOrigin(details.origin) && supported(details.device) &&
    !!trustedWindow() && grants.includes(`${originOf(details.origin)}|${identity(details.device)}`));
  session.on('hid-device-revoked', (_event, details) => {
    const key = `${originOf(details.origin)}|${identity(details.device)}`;
    grants = grants.filter(value => value !== key);
    save();
  });
  session.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const window = trustedWindow();
    const frame = details.frame;
    if (!window || !frame || !isGameUrl(frame.url) ||
        (frame !== window.webContents.mainFrame && frame.top !== window.webContents.mainFrame)) {
      callback(''); return;
    }
    const devices = details.deviceList.filter(supported);
    if (!devices.length) {
      dialog.showMessageBox(window, { type: 'info', message: 'No supported DualSense HID device is available to Electron.', detail: 'Controller input and WebHID are separate. Check the USB/Bluetooth connection and host device permissions.', buttons: ['OK'] });
      callback(''); return;
    }
    dialog.showMessageBox(window, {
      type: 'question', title: 'DualSense controller',
      message: 'Choose a controller for adaptive triggers and lighting',
      buttons: ['Cancel', ...devices.map((device, index) => `${device.name || 'DualSense'} (${index + 1})`)],
      defaultId: 0, cancelId: 0, noLink: true,
    }).then(result => {
      const selected = devices[result.response - 1];
      if (!selected || !trustedWindow() || !isGameUrl(frame.url)) { callback(''); return; }
      const key = `${originOf(frame.url)}|${identity(selected)}`;
      if (!grants.includes(key)) { grants.push(key); save(); }
      callback(selected.deviceId);
    }, () => callback(''));
  });
}
module.exports = { installControllerHID };
