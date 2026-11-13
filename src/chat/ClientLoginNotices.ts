import type { API } from '../api/Types';
import { MessageLog, type GameScene, type Client } from '../game/Bindings';
import { PodRewardNotice } from './PodRewardNotice';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { isClientDeveloper } from '../visuals/ClientVisualAuthority';

/** Original local-only developer notices, deduplicated across warps by login token. */
export class ClientLoginNotices {
  private static owner: Client | null = null;
  private static ownerId = '';
  private static seen = new Set<string>();
  private disposed = false;

  constructor(
    private api: API,
    private game: GameScene,
    private ipc: ClientIPCService,
  ) {
    const player = game.get_me();
    if (!this.authorized() || !player) {
      this.disposed = true;
      return;
    }
    const id = player.id;
    if (ClientLoginNotices.owner !== game.client || ClientLoginNotices.ownerId !== id) {
      ClientLoginNotices.owner = game.client;
      ClientLoginNotices.ownerId = id;
      ClientLoginNotices.seen.clear();
    }
    ipc.addPeerHandler(this.onPeer);
    for (const peer of ipc.onlinePlayers) this.onPeer(peer.id, peer.name);
  }

  private authorized(): boolean {
    const player = this.game.get_me();
    return (
      !this.disposed &&
      this.api.game === this.game &&
      !this.game.get_isLeaving() &&
      !!player &&
      this.game.client?.connectUserId === player.id &&
      isClientDeveloper(player.id) &&
      this.ipc === ClientIPCService.instance
    );
  }

  private readonly onPeer = (id: string, _name: string): void => {
    const ownerId = this.game.get_me()?.id;
    if (
      !this.authorized() ||
      !this.ipc.connected ||
      !this.game.messageLog ||
      ClientLoginNotices.owner !== this.game.client ||
      ClientLoginNotices.ownerId !== ownerId ||
      id === ownerId
    )
      return;
    const info = this.ipc.peerLoginInfo(id);
    if (
      !info ||
      info.id !== id ||
      typeof info.loginId !== 'string' ||
      typeof info.version !== 'string' ||
      !/^[0-9a-f]{12}$/.test(info.loginId) ||
      !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(info.version) ||
      (info.build !== 'Public' && info.build !== 'Private') ||
      typeof info.name !== 'string'
    )
      return;
    const key = id + ':' + info.loginId;
    if (ClientLoginNotices.seen.has(key)) return;
    const name = PodRewardNotice.escape(info.name.replace(/[\r\n\t]/g, ' ') || id, 180);
    const log = MessageLog;
    // Capture the newly queued object so retained history belongs to this viewer.
    const before = new Set(log.textQueue ?? []);
    log.write(
      "<font color='#ffcc33'>" +
        name +
        ' logged-in to the game with QoLAF ' +
        info.version +
        ' (' +
        info.build +
        ')</font>',
      'system',
    );
    for (const row of log.textQueue ?? [])
      if (!before.has(row)) row.clientDeveloperNoticeOwner = ownerId;
    ClientLoginNotices.seen.add(key);
    if (ClientLoginNotices.seen.size > 4096)
      ClientLoginNotices.seen.delete(ClientLoginNotices.seen.values().next().value!);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ipc.removePeerHandler(this.onPeer);
  }
}

export function installClientLoginNotices(api: API, game: GameScene): void {
  const log = MessageLog;
  const ownerId = game.client?.connectUserId;
  if (Array.isArray(log?.textQueue)) {
    log.textQueue = log.textQueue.filter(
      (row) =>
        !row.clientDeveloperNoticeOwner ||
        (isClientDeveloper(ownerId) && row.clientDeveloperNoticeOwner === ownerId),
    );
  }
  if (!isClientDeveloper(ownerId)) return;
  let ipc: ClientIPCService | null = null;
  let notices: ClientLoginNotices | null = null;
  const attach = () => {
    const current = ClientIPCService.instance;
    if (current === ipc) return;
    notices?.dispose();
    ipc = current;
    notices = current ? new ClientLoginNotices(api, game, current) : null;
  };
  attach();
  api.interval(attach, 250);
  api.defer(() => notices?.dispose());
}
