import type { GameScene, Player } from '../game/Bindings';
import type { ChatFriendPingData } from './ChatFriendPingData';

export interface ChatSenderSnapshot {
  playerId?: string | null;
  clanId?: string;
  clanName?: string;
}

/** Source MessageLog identity projection; never used to authorize relay messages. */
export function snapshotChatSender(
  game: GameScene,
  message: ChatSenderSnapshot,
  wireId: string | null,
  name: string | null,
  relay: boolean,
  targets: readonly ChatFriendPingData[],
): void {
  const manager = game.playerManager;
  const wirePlayer = wireId ? manager?.get_playersById().h[wireId] : undefined;
  let livePlayer: Player | undefined = wirePlayer;
  const normalized = name?.toLowerCase() ?? '';
  if (!livePlayer && manager) {
    const matches = manager
      .get_players()
      .filter((player) => player.get_name()?.toLowerCase() === normalized);
    if (matches.length === 1) livePlayer = matches[0];
  }
  const me = game.get_me();
  message.playerId = relay
    ? wireId
    : (livePlayer?.id ??
      (me?.get_name()?.toLowerCase() === normalized
        ? game.client.connectUserId
        : (targets.find((target) => target.name.toLowerCase() === normalized)?.playerId ?? '')));

  // Source clan snapshots require the exact wire lookup, not a name fallback.
  if (wirePlayer?.clanId) message.clanId = wirePlayer.clanId;
  if (wirePlayer?.clanName) message.clanName = wirePlayer.clanName;
}
