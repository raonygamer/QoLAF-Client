import type {} from '../game/InitialWorld';
import { GameScene, GUID, PlayerManager, type Client } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';

export type RoomReplyResult =
  | { requestType: 'qipc3.room.invite'; result: 'accepted' | 'declined' }
  | { requestType: 'qipc3.room.kick'; result: 'received' };

/** Capture an authenticated receipt before an accepted action can tear down its Game. */
export function prepareRoomControlReply(
  game: GameScene,
  recipientId: string,
  requestNonce: string,
  reply: RoomReplyResult,
): (() => void) | null {
  const transport = ClientIPCService.instance;
  const player = game.get_me();
  if (
    GameScene.instance !== game ||
    game.get_isLeaving() ||
    !player ||
    !transport?.connected ||
    game.client.connectUserId !== player.id ||
    !game.get_initialWorldIsRevealed() ||
    !game.clock
  )
    return null;
  const serverTime = game.clock.getServerTime() / 1000;
  if (!Number.isFinite(serverTime)) return null;
  return immutableReplySender(
    transport,
    game.client,
    player.id,
    recipientId,
    requestNonce,
    reply.requestType,
    reply.result,
    serverTime,
  );
}

/** This closure owns only authentication and copied primitives, never the scene/composer. */
function immutableReplySender(
  transport: ClientIPCService,
  owner: Client,
  localId: string,
  recipientId: string,
  requestNonce: string,
  requestType: RoomReplyResult['requestType'],
  result: RoomReplyResult['result'],
  serverTime: number,
): () => void {
  const nonce = GUID.create().replace(/-/g, '').toUpperCase();
  const createdAt = performance.now();
  let submitted = false;
  const ready = () =>
    ClientIPCService.instance === transport &&
    transport.connected &&
    owner.connectUserId === localId &&
    !(PlayerManager.banMinutes > 0 && PlayerManager.isAllChannels);
  return () => {
    if (submitted) return;
    submitted = true;
    if (!ready() || transport.findPeer(recipientId)?.id !== recipientId) return;
    transport.send(
      recipientId,
      { type: 'qipc3.room.reply', fields: [] },
      {
        beforeSend: () => {
          if (!ready()) return null;
          return {
            type: 'qipc3.room.reply',
            fields: [
              'game',
              recipientId,
              nonce,
              serverTime + (performance.now() - createdAt) / 1000,
              requestNonce,
              requestType,
              result,
            ],
          };
        },
      },
    );
  };
}
