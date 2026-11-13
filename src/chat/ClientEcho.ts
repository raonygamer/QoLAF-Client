import type { API } from '../api/Types';
import { MessageLog, type GameScene } from '../game/Bindings';
import { ClientIPCEcho } from '../ipc/ClientIPCEcho';
import { PodRewardNotice } from './PodRewardNotice';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { CLIENT_BUILD, CLIENT_VERSION_LABEL } from '../login/LoginIdentity';

/** MessageLog/ChatInputText share the original release label and echo color. */
export function clientEchoText(): string {
  return `<font color='#9B5CFF'>QoLAF (Server ${ClientIPCService.serverVersion} / v${CLIENT_VERSION_LABEL} (${CLIENT_BUILD}))</font>`;
}

/** Replies follow the authenticated client across room refreshes, never account changes. */
export function runClientEcho(api: API, game: GameScene): void {
  const owner = game.client;
  const ownerId = owner?.connectUserId;
  const echo = ClientIPCEcho.instance;
  if (!owner || !echo) {
    MessageLog.write('Client IPC is not ready.', 'error');
    return;
  }
  echo.request((event) => {
    const current = api.game;
    if (
      !current ||
      current.get_isLeaving() ||
      current.client !== owner ||
      current.client.connectUserId !== ownerId ||
      !current.messageLog
    )
      return;
    if (event.kind === 'reply') {
      const name = PodRewardNotice.escape(event.name, 180);
      MessageLog.write(
        `<font color='#9B5CFF'>${name} - QoLAF (Server ${event.gameProtocol} / v${event.version} (${event.build}))</font>`,
      );
    } else if (event.kind === 'start') MessageLog.write('Checking QoLAF clients over IPC...');
    else if (event.kind === 'end')
      MessageLog.write('Client check finished: ' + event.count + ' replies.');
    else MessageLog.write(event.message, 'error');
  });
}
