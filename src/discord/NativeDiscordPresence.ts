import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { ChatInputText, SceneBase, MessageLog } from '../game/Bindings';
import { DiscordPresence, validApplicationId, type DiscordBridge } from './DiscordPresence';
import { snapshotDiscordActivity } from './DiscordActivity';

declare global {
  interface Window {
    qolafDiscord?: DiscordBridge;
  }
}

export function installNativeDiscordPresence(api: API): void {
  const reflection = new GameReflection(api);
  let disposed = false;
  const presence = new DiscordPresence(
    window.qolafDiscord,
    () => SceneBase.clientSettings,
    () => snapshotDiscordActivity(api.game ? reflection.cast(api.game, 'core.scene.Game') : null),
  );
  const timer = setInterval(() => void presence.tick(), 1000);
  void presence.tick();
  api.defer(() => {
    disposed = true;
    clearInterval(timer);
    presence.dispose();
  });
  reflection.around(ChatInputText.prototype, 'sendMessage', function (next, ...args) {
    const text = this.input.get_text();
    if (!text.startsWith('/')) return next(...args);
    const [name, argument = ''] = this.parseCommand(text);
    if (name !== 'discordpresence') return next(...args);
    this.input.set_text('');
    this.updateTab();
    const parts = argument.trim().split(/\s+/);
    const action = parts[0].toLowerCase();
    const settings = SceneBase.clientSettings;
    if (!settings) {
      MessageLog.write('Discord Rich Presence is unavailable in this host.');
      return;
    }
    if ((action === 'on' || action === 'off') && parts.length === 1)
      settings.discordPresenceEnabled = action === 'on';
    else if (action === 'app' && parts.length === 2 && validApplicationId(parts[1]))
      settings.discordPresenceApplicationId = parts[1];
    else if (!((action === '' || action === 'status') && parts.length === 1)) {
      MessageLog.write('Usage: /discordpresence [on|off|status|app <application ID>]');
      return;
    }
    if (action && action !== 'status') presence.reset();
    void presence.tick().then(() => {
      if (!disposed) MessageLog.write('Discord Rich Presence: ' + presence.statusText + '.');
    });
  });
}
