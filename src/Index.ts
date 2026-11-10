import { read, type API } from './Api/Types';
import { installGameSession } from './Runtime/GameSession';
import { ChatHistory } from './Chat/ChatHistory';
import { installNativeBitmapText } from './UI/NativeBitmapText';
import { loadFonts } from './UI/Fonts';
import { loginIdentity, PORT_VERSION } from './Login/LoginIdentity';
import { loginProfiles } from './Login/LoginProfiles';
import { installArtifactUI } from './Artifacts/NativeArtifacts';
import { installInterpolation } from './Rendering/Interpolation';
import { installDisplayScale } from './Rendering/DisplayScale';
import { installCompactStarMap } from './Map/CompactStarMap';
import { DeviceSettings } from './Settings/DeviceSettings';
import { installBackgroundLayers } from './Rendering/BackgroundLayers';

export default {
  id: 'qolaf.client',
  name: 'QoLAF Client',
  version: PORT_VERSION,
  apiVersion: 1,
  activate(api: API) {
    const history = new ChatHistory();
    const deviceSettings = new DeviceSettings(api.storage);
    api.defer(() => deviceSettings.flush());
    let fonts: Promise<void> | undefined;
    const ensureFonts = () =>
      (fonts ??= loadFonts(api).then(() => {
        // This bridge targets the OpenFL-backed Haxe Text ABI. Starling's own
        // TextField has a different constructor and must never be patched here.
        if (typeof api.cls('core.hud.components.Text')?.prototype.set_htmlText === 'function') {
          installNativeBitmapText(api);
        }
      }));
    api.on('classesReady', () => {
      installInterpolation(api);
      installDisplayScale(api, deviceSettings);
      const login = api.cls('Login')!.prototype;
      api.around(login, 'connectSteam', function (next, ...args) {
        if (this.$qolafAllowSteam) return next(...args);
      });
      api.after(login, 'init', function () {
        const instance = this;
        void ensureFonts()
          .then(() => {
            if (read(instance, 'stage')) {
              api.defer(loginIdentity(api, instance));
              api.defer(loginProfiles(api, instance));
            }
          })
          .catch((error) => api.log('Login font initialization failed', error));
      });
      const chat = api.cls('core.hud.components.chat.ChatInputText')!.prototype;
      api.around(chat, 'previous', function () {
        this.input.set_text(history.previous(this.input.get_text()));
      });
      api.around(chat, 'next', function () {
        this.input.set_text(history.next(this.input.get_text()));
      });
      api.after(chat, 'closeChat', () => history.begin());
      api.around(chat, 'sendMessage', function (next, ...args) {
        const text = this.input.get_text();
        const result = next(...args);
        history.record(text);
        return result;
      });
      installArtifactUI(api);
      installCompactStarMap(api);
    });
    api.onGame((game, session) => {
      installBackgroundLayers(game, session, deviceSettings);
      let alive = true;
      session.defer(() => {
        alive = false;
      });
      void ensureFonts()
        .then(() => {
          if (!alive) return;
          installGameSession(game, session, deviceSettings);
        })
        .catch((error) => session.log('Native client initialization failed', error));
    });
  },
};
