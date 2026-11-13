import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { MessageLog, MD5, DataLocator, PlayerManager, type GameScene } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { ClientQolafChat, type QolafChatRow } from './ClientQolafChat';
import { PodRewardNotice } from './PodRewardNotice';
import { RareArtifactNotice } from './RareArtifactNotice';
import { PurchaseNotice } from './PurchaseNotice';
import type { ChatSubmission } from '../game/ChatSubmission';

/** Called at authentication as well as scene attachment: warping must not drop the inbox. */
export function ensureNativeQolafChat(api: API, id: string, name = '') {
  return ClientQolafChat.ensure(ClientIPCService.instance, id, name, {
    now: () => performance.now(),
    interval: (callback, ms) => {
      const timer = setInterval(callback, ms);
      return () => clearInterval(timer);
    },
    hash: (text) => MD5.hash(text),
    skinName: (key) => {
      const skin: unknown = DataLocator.getService().loadKey('Skins', key);
      if (!skin || typeof skin !== 'object' || !('name' in skin)) return null;
      return typeof skin.name === 'string' ? skin.name : null;
    },
  });
}

/** Original QoLAF channel on the native composer and its existing rich-message pipeline. */
export function installNativeQolafChat(api: API, game: GameScene): void {
  const chat: ChatSubmission | null = game.chatInput;
  const reflection = new GameReflection(api);
  const log = MessageLog;
  const messageLog = game.messageLog;
  if (!chat?.tabs || !messageLog || !game.client?.connectUserId) return;
  const registry: unknown = api.cls('af.ChatCommandRegistry');
  if (registry && (typeof registry === 'object' || typeof registry === 'function')) {
    const reserve: unknown = Reflect.get(registry, 'reserveBuiltInCommands');
    if (typeof reserve === 'function') Reflect.apply(reserve, registry, [['qolaf']]);
  }
  const ownerId = game.client.connectUserId;
  const entry = { label: 'QoLAF', chatMode: 'qolaf' };
  const previousTabs = chat.tabs.dataProvider.slice();
  if (!previousTabs.some((tab) => tab.chatMode === 'qolaf')) {
    const tabs = previousTabs.slice();
    // Native sendPrivate updates the final tab. Keep it last when enabling
    // the plugin in a session that already has a private recipient.
    const privateIndex = tabs.findIndex((tab) => tab.chatMode === 'privateSaved');
    tabs.splice(privateIndex < 0 ? tabs.length : privateIndex, 0, entry);
    chat.tabs.set_dataProvider(tabs);
  }
  chat.updateTab();
  // Session history survives warps, but IPC rows belong to one authenticated account.
  log.textQueue = log.textQueue.filter((row) => !row.qolafOwner || row.qolafOwner === ownerId);
  let service: ClientQolafChat | null = null;
  let receiving: QolafChatRow | null = null;
  const current = () =>
    api.game === game &&
    !game.get_isLeaving() &&
    game.client?.connectUserId === ownerId &&
    log.g === game &&
    !!game.messageLog;
  reflection.around(log, 'colorCoding', function (next, text: string) {
    return next(text).replaceAll('[qolaf]', "<font color='#82cfff'>[qolaf]</font>");
  });
  reflection.around(messageLog, 'updateTexts', function (next, row, ...args) {
    if (receiving && row) {
      row.qolafOwner = ownerId;
      row.playerId = row.playerKey = receiving.senderId;
      row.playerName = receiving.senderName;
    }
    return next(row, ...args);
  });
  const receive = (row: QolafChatRow) => {
    if (!current() || row.ownerId !== ownerId) return false;
    const previous = receiving;
    receiving = row;
    try {
      if (row.kind) {
        const text =
          row.kind === 'podReward'
            ? PodRewardNotice.format(row.senderName, row.body)
            : row.kind === 'artifactReward'
              ? RareArtifactNotice.format(row.senderName, row.body, row.level)
              : PurchaseNotice.format(row.senderName, row.body);
        if (text) log.write(text, 'system');
      } else {
        const me = game.get_me();
        const sender =
          row.senderId === me?.id ? me : game.playerManager?.get_playersById().h[row.senderId];
        log.writeChatMsg(
          'qolaf',
          row.body,
          row.senderId,
          PodRewardNotice.escape(row.senderName),
          '',
          sender?.hasSupporter() ?? false,
        );
      }
      return true;
    } finally {
      receiving = previous;
    }
  };
  const attach = () => {
    if (!current()) return;
    const next = ensureNativeQolafChat(api, ownerId, game.get_me()?.get_name() ?? '');
    if (service !== next) {
      service?.detachReceiver(receive);
      service = next;
      service?.attachReceiver(receive);
    }
  };
  attach();
  api.interval(attach, 250);
  const error = (message: string) => {
    if (current()) log.write(message, 'error');
  };
  reflection.around(chat, 'sendMessage', function (next, ...args) {
    const text = chat.input.get_text();
    const command = chat.parseCommand(text);
    if (command[0] !== 'qolaf') return next(...args);
    chat.chatMode = 'qolaf';
    chat.updateTab();
    if (command.length < 2 || !command[1]) {
      chat.input.set_text('');
      return true;
    }
    attach();
    if (!current() || !service || !ClientIPCService.instance?.connected) {
      error('QoLAF chat is not connected yet. Your message was kept in the input.');
      return false;
    }
    if (PlayerManager && PlayerManager.banMinutes > 0 && PlayerManager.isAllChannels) {
      error('You are banned from chat for ' + PlayerManager.banMinutes + ' more minutes.');
      return false;
    }
    if (messageLog.isMuted('qolaf')) {
      error('You have muted QoLAF chat.');
      return false;
    }
    if (
      !service.send(command[1], (reason) =>
        error('QoLAF message could not be sent: ' + PodRewardNotice.escape(reason)),
      )
    )
      return false;
    chat.input.set_text('');
    chat.updateTab();
    return true;
  });
  api.defer(() => {
    service?.detachReceiver(receive);
    service = null;
    if (!game.get_isLeaving()) {
      const tabs = chat.tabs.dataProvider.filter((tab) => tab !== entry);
      chat.tabs.set_dataProvider(tabs);
      if (chat.chatMode === 'qolaf') chat.chatMode = 'local';
      chat.updateTab();
    }
  });
}
