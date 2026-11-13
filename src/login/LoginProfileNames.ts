import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { PlayerManager, type Client, type GameScene } from '../game/Bindings';
import { decodeLoginProfileState } from './LoginProfileState';

/** Original authenticated profile name cache, bound to the client that logged in. */
export class LoginProfileNames {
  private static authenticated: { client: Client; userId: string; profileId: string } | null = null;

  static clear(): void {
    this.authenticated = null;
  }

  static authenticate(client: Client, profileId: string): void {
    this.authenticated =
      client && profileId ? { client, userId: client.connectUserId, profileId } : null;
  }

  static remember(api: API, game: GameScene): void {
    const owner = this.authenticated;
    if (
      !owner ||
      game.client !== owner.client ||
      game.client.connectUserId !== owner.userId ||
      game.get_isLeaving()
    )
      return;
    const player = game.get_me();
    if (!player || player.id !== owner.userId) return;
    const name = player.get_name().trim().slice(0, 64);
    if (!name) return;
    const stored = api.storage.get<unknown>('login.profiles', null);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
    const saved = decodeLoginProfileState(stored);
    if (owner.profileId.startsWith('steam:')) {
      const names = saved.steamProfileNames;
      if (names[owner.profileId] === name) return;
      api.storage.set('login.profiles', {
        ...saved,
        steamProfileNames: { ...names, [owner.profileId]: name },
      });
    } else if (owner.profileId.startsWith('site:') && Array.isArray(saved.profiles)) {
      let changed = false;
      const profiles = saved.profiles.map((profile) => {
        if (!profile || profile.id !== owner.profileId || profile.accountName === name)
          return profile;
        changed = true;
        return { ...profile, accountName: name };
      });
      if (changed) api.storage.set('login.profiles', { ...saved, profiles });
    }
  }
}

export function installLoginProfileNames(api: API): void {
  const reflection = new GameReflection(api);
  reflection.after(PlayerManager.prototype, 'initPlayer', function () {
    LoginProfileNames.remember(api, this.g);
  });
  api.defer(() => LoginProfileNames.clear());
}
