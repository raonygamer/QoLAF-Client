import { read, type API, type Raw } from '../api/Types';
import type { AutocompleteFriend } from './ChatFriendAutocompleteModel';

/** Reads persistent friend identities and hydrates previews from live room players. */
export class ChatFriendRoster {
  private nextRefreshAt = 0;
  private disposed = false;
  private textures = new Map<string, Raw | null>();

  constructor(
    private api: API,
    private game: Raw,
    private now = () => performance.now(),
  ) {}

  records(): AutocompleteFriend[] {
    const Player = this.api.cls('core.player.Player');
    const players: Raw[] = read(this.game.playerManager, 'players', []);
    const messages: Raw[] = this.api.cls('core.hud.components.chat.MessageLog')?.textQueue ?? [];
    const records: Raw[] = [...(Player?.onlineFriends ?? []), ...(Player?.friends ?? [])];
    for (const friend of records) {
      if (!friend) continue;
      let player = friend.id ? players.find((player) => player.id === friend.id) : undefined;
      if (!player && friend.name) {
        const matches = players.filter(
          (player) => read(player, 'name', '').toLowerCase() === friend.name.toLowerCase(),
        );
        if (matches.length === 1) player = matches[0];
      }
      if (player) {
        const skin = read(player, 'activeSkin');
        if (skin) friend.skin = skin;
        const fleet = player.getActiveFleetObj?.();
        if (fleet)
          for (const property of ['Hue', 'Brightness', 'Saturation', 'Contrast']) {
            friend['previewShip' + property] = read(fleet, 'ship' + property, 0);
          }
      }
      if (!friend.playerId) {
        friend.playerId = player?.id || friend.id || '';
        if (!friend.playerId && friend.name) {
          const normalized = friend.name.toLowerCase();
          const message = [...messages]
            .reverse()
            .find(
              (message) => message.playerName?.toLowerCase() === normalized && message.playerId,
            );
          friend.playerId = message?.playerId ?? '';
        }
      }
    }
    return records as AutocompleteFriend[];
  }

  refresh(onReady: () => void): void {
    if (this.disposed || !this.game.friendManager || this.now() < this.nextRefreshAt) return;
    this.nextRefreshAt = this.now() + 30000;
    this.game.friendManager.updateOnlineFriends(() => {
      if (!this.disposed) onReady();
    });
  }

  texture(skinKey: string): Raw | null {
    if (this.textures.has(skinKey)) return this.textures.get(skinKey)!;
    let texture: Raw | null = null;
    try {
      const skin = this.game.dataManager.loadKey('Skins', skinKey);
      const ship = skin ? this.game.dataManager.loadKey('Ships', skin.ship) : null;
      const manager = this.api.cls('textures.TextureLocator')?.getService();
      if (ship?.bitmap && manager) texture = manager.getTexturesMainByKey(ship.bitmap)?.[0] ?? null;
    } catch {
      /* Source caches missing previews as well as valid shared textures. */
    }
    this.textures.set(skinKey, texture);
    return texture;
  }

  dispose(): void {
    this.disposed = true;
    this.textures.clear();
  }
}
