'use strict';

// WebHID remains opt-in through the in-game Connect button and this device picker.
function installControllerHID(session, dialog, getWindow, isGameUrl) {
  const allowedOrigin = origin => ['https://raony.dev', 'https://astroflux.net', 'https://beta.astroflux.net'].includes(origin);
  session.setPermissionCheckHandler((contents, permission, origin) =>
    permission === 'hid' && allowedOrigin(origin) &&
    contents === getWindow()?.webContents && isGameUrl(contents.getURL()));
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(permission === 'hid' && contents === getWindow()?.webContents &&
      isGameUrl(contents.getURL()) && allowedOrigin(details?.requestingUrl ? new URL(details.requestingUrl).origin : ''));
  });
  session.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const window = getWindow();
    if (!window || !details.frame || details.frame.parent !== null || !isGameUrl(details.frame.url)) {
      callback('');
      return;
    }
    const devices = details.deviceList.filter(device => device.vendorId === 0x054c && [0x0ce6, 0x0df2].includes(device.productId));
    if (!devices.length) { callback(''); return; }
    dialog.showMessageBox(window, {
      type: 'question', title: 'DualSense controller',
      message: 'Choose a controller for adaptive triggers and lighting',
      buttons: ['Cancel', ...devices.map((device, index) => `${device.name || 'DualSense'} (${index + 1})`)],
      defaultId: 0, cancelId: 0, noLink: true,
    }).then(result => callback(devices[result.response - 1]?.deviceId ?? ''), () => callback(''));
  });
}
module.exports = { installControllerHID };
