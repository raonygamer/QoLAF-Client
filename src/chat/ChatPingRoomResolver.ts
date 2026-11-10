import type { Raw } from '../api/Types';
import type { ChatFriendPingData } from './ChatFriendPingData';
import { displayPingSystemType } from '../ported/ChatFriendPingPreviewPopup';

/** Original lazy RoomInfo lookup: four requests, coalesced waiters, 30s failed lookup retry. */
export class ChatPingRoomResolver {
  private cache = new Map<string, string>();
  private retryAfter = new Map<string, number>();
  private pending = new Map<string, Set<ChatFriendPingData>>();
  private disposed = false;

  constructor(
    private game: Raw,
    private onResolved: (ping: ChatFriendPingData) => void,
    private now = () => performance.now(),
  ) {}

  resolve(ping: ChatFriendPingData): void {
    if (this.disposed || ping.systemType || !this.game.client) return;
    const key = this.key(ping);
    if (!key) return;
    const cached = this.cache.get(key);
    if (cached) {
      ping.systemType = cached;
      return;
    }
    if ((this.retryAfter.get(key) ?? 0) > this.now()) return;
    this.retryAfter.delete(key);
    const waiting = this.pending.get(key);
    if (waiting) {
      waiting.add(ping);
      return;
    }
    if (this.pending.size >= 4) return;
    const waiters = new Set([ping]);
    this.pending.set(key, waiters);
    const expectedRoom = ping.room;
    const finish = (type: string) => {
      if (this.disposed || this.pending.get(key) !== waiters) return;
      this.pending.delete(key);
      if (type) this.cache.set(key, type);
      else this.retryAfter.set(key, this.now() + 30000);
      if (type)
        for (const target of waiters) {
          if (this.disposed) break;
          if (this.key(target) !== key) continue;
          target.systemType = type;
          this.onResolved(target);
        }
    };
    try {
      this.game.client.multiplayer.listRooms(
        'game',
        { solarSystemKey: ping.solarSystemKey },
        100,
        0,
        (rooms: Raw[] | null) => {
          const room = rooms?.find((room) => room && String(room.id) === expectedRoom);
          const type = String(room?.data?.systemType ?? '')
            .trim()
            .toLowerCase();
          finish(displayPingSystemType(type) ? type : '');
        },
        () => finish(''),
      );
    } catch {
      finish('');
    }
  }

  private key(ping: ChatFriendPingData): string | null {
    return ping.solarSystemKey && ping.room
      ? JSON.stringify([ping.solarSystemKey, ping.room])
      : null;
  }

  dispose(): void {
    this.disposed = true;
    this.pending.clear();
    this.cache.clear();
    this.retryAfter.clear();
  }
}
