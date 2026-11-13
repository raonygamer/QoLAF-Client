import { Player, MessageLog, TextureLocator, type GameScene, type Texture } from '../game/Bindings';
import type { AutocompleteFriend } from './ChatFriendAutocompleteModel';
import { ChatMessageContextData } from './ChatMessageContextData';

/** Reads persistent friend identities and hydrates previews from live room players. */
export class ChatFriendRoster {
  private nextRefreshAt = 0;
  private disposed = false;
  private textures = new Map<string, Texture | null>();

  constructor(
    private game: Pick<GameScene, 'playerManager' | 'dataManager' | 'friendManager'>,
    private now = () => performance.now(),
  ) {}

  records(): AutocompleteFriend[] {
    const manager = this.game.playerManager;
    const players = manager?.get_players() ?? [];
    const messages = MessageLog.textQueue ?? [];
    const records: AutocompleteFriend[] = [
      ...(Player.onlineFriends ?? []),
      ...(Player.friends ?? []),
    ];
    for (const friend of records) {
      if (!friend) continue;
      let player = friend.id ? manager?.get_playersById().h[friend.id] : undefined;
      if (!player && friend.name) {
        const name = friend.name.toLowerCase();
        const matches = players.filter(
          (player) => player && player.get_name()?.toLowerCase() === name,
        );
        if (matches.length === 1) player = matches[0];
      }
      if (player) {
        if (player.activeSkin) friend.skin = player.activeSkin;
        const fleet = player.getActiveFleetObj();
        if (fleet) {
          friend.previewShipHue = fleet.shipHue;
          friend.previewShipBrightness = fleet.shipBrightness;
          friend.previewShipSaturation = fleet.shipSaturation;
          friend.previewShipContrast = fleet.shipContrast;
        }
      }
      if (!friend.playerId) {
        friend.playerId = player?.id || friend.id || '';
        if (!friend.playerId && friend.name) {
          const name = friend.name.toLowerCase();
          for (let index = messages.length - 1; index >= 0; index--) {
            const message = messages[index];
            if (ChatMessageContextData.propertyText(message, 'playerName').toLowerCase() !== name)
              continue;
            const id = ChatMessageContextData.propertyText(message, 'playerId');
            if (id) {
              friend.playerId = id;
              break;
            }
          }
        }
      }
    }
    return records;
  }

  refresh(onReady: () => void): void {
    if (this.disposed || !this.game.friendManager || this.now() < this.nextRefreshAt) return;
    this.nextRefreshAt = this.now() + 30000;
    this.game.friendManager.updateOnlineFriends(() => {
      if (!this.disposed) onReady();
    });
  }

  texture(skinKey: string): Texture | null {
    if (!skinKey || !this.game.dataManager) return null;
    if (this.textures.has(skinKey)) return this.textures.get(skinKey)!;
    let texture: Texture | null = null;
    try {
      const skin: unknown = this.game.dataManager.loadKey('Skins', skinKey);
      const shipKey = this.recordText(skin, 'ship');
      const ship: unknown = shipKey ? this.game.dataManager.loadKey('Ships', shipKey) : null;
      const bitmap = this.recordText(ship, 'bitmap');
      const manager = TextureLocator.getService();
      if (bitmap && manager) texture = manager.getTexturesMainByKey(bitmap)?.[0] ?? null;
    } catch {
      /* Source caches missing previews as well as valid shared textures. */
    }
    this.textures.set(skinKey, texture);
    return texture;
  }

  private recordText(record: unknown, key: string): string {
    return record !== null && typeof record === 'object'
      ? ChatMessageContextData.propertyText(record, key)
      : '';
  }

  dispose(): void {
    this.disposed = true;
    this.textures.clear();
  }
}
