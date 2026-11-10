import { read, type API, type Raw } from '../api/Types';
import { ClientIpcService } from '../ipc/ClientIpcService';
import { ClientQolafChat, type QolafChatRow } from './ClientQolafChat';
import { PodRewardNotice } from './PodRewardNotice';
import { RareArtifactNotice } from './RareArtifactNotice';
import { PurchaseNotice } from './PurchaseNotice';

/** Called at authentication as well as scene attachment: warping must not drop the inbox. */
export function ensureNativeQolafChat(api: API, id: string, name = '') {
  return ClientQolafChat.ensure(ClientIpcService.instance, id, name, {
    now: () => performance.now(),
    interval: (callback, ms) => {
      const timer = setInterval(callback, ms);
      return () => clearInterval(timer);
    },
    hash: (text) => api.cls('com.adobe.crypto.MD5')!.hash(text),
    skinName: (key) =>
      api.cls('data.DataLocator')?.getService().loadKey('Skins', key)?.name ?? null,
  });
}

/** Original QoLAF channel on the native composer and its existing rich-message pipeline. */
export function installNativeQolafChat(api: API, game: Raw): void {
  const chat = game.chatInput;
  const log = api.cls('core.hud.components.chat.MessageLog');
  if (!chat?.tabs || !log || !game.client?.connectUserId) return;
  api.cls('af.ChatCommandRegistry')?.reserveBuiltInCommands(['qolaf']);
  const ownerId = game.client.connectUserId;
  const entry = { label: 'QoLAF', chatMode: 'qolaf' };
  const previousTabs = chat.tabs.dataProvider.slice();
  if (!previousTabs.some((tab: Raw) => tab.chatMode === 'qolaf'))
    chat.tabs.set_dataProvider([...previousTabs, entry]);
  chat.updateTab();
  // Session history survives warps, but IPC rows belong to one authenticated account.
  log.textQueue = log.textQueue.filter((row: Raw) => !row.qolafOwner || row.qolafOwner === ownerId);
  let service: ClientQolafChat | null = null;
  let receiving: QolafChatRow | null = null;
  const current = () =>
    api.game === game &&
    !game.isLeaving &&
    game.client?.connectUserId === ownerId &&
    log.g === game &&
    !!game.messageLog;
  api.around(log, 'colorCoding', function (next, text: string) {
    return next(text).replaceAll('[qolaf]', "<font color='#82cfff'>[qolaf]</font>");
  });
  api.around(game.messageLog, 'updateTexts', function (next, row, ...args) {
    if (receiving) {
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
        const players = read(game.playerManager, 'playersById');
        const sender =
          row.senderId === game.me?.id
            ? game.me
            : (players?.h?.[row.senderId] ?? players?.[row.senderId]);
        log.writeChatMsg(
          'qolaf',
          row.body,
          row.senderId,
          PodRewardNotice.escape(row.senderName),
          '',
          !!read(sender, 'isSupporter', false),
        );
      }
      return true;
    } finally {
      receiving = previous;
    }
  };
  const attach = () => {
    if (!current()) return;
    const next = ensureNativeQolafChat(api, ownerId, read(game.me, 'name', ''));
    if (service !== next) {
      service?.detachReceiver(receive);
      service = next;
      service?.attachReceiver(receive);
    }
  };
  attach();
  api.interval(attach, 250);
  const error = (message: string) => {
    if (current()) log.write('[error] ' + PodRewardNotice.escape(message), 'error');
  };
  api.around(chat, 'sendMessage', function (next, ...args) {
    const text = read(chat.input, 'text', '');
    const command = chat.parseCommand(text);
    if (command[0] !== 'qolaf') return next(...args);
    chat.chatMode = 'qolaf';
    chat.updateTab();
    if (command.length < 2 || !command[1]) {
      chat.input.set_text('');
      return;
    }
    attach();
    if (!service || !ClientIpcService.instance?.connected) {
      error('QoLAF chat is not connected yet. Your message was kept in the input.');
      return false;
    }
    const PlayerManager = api.cls('core.player.PlayerManager');
    if (PlayerManager && PlayerManager.banMinutes > 0 && PlayerManager.isAllChannels) {
      error('You are currently silenced in all channels.');
      return false;
    }
    if (game.messageLog.isMuted('qolaf')) {
      error('QoLAF chat is muted. Unmute it before sending.');
      return false;
    }
    if (!service.send(command[1], error)) return false;
    chat.input.set_text('');
    chat.updateTab();
    return true;
  });
  api.defer(() => {
    service?.detachReceiver(receive);
    service = null;
    if (!game.isLeaving) {
      const tabs = chat.tabs.dataProvider.filter((tab: Raw) => tab !== entry);
      chat.tabs.set_dataProvider(tabs);
      if (chat.chatMode === 'qolaf') chat.chatMode = 'local';
      chat.updateTab();
    }
  });
}
