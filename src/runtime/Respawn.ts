import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  KilledPlayerState,
  RoamingState,
  StarlingTextField,
  type GameScene,
} from '../game/Bindings';
import type { DeviceSettings } from '../settings/DeviceSettings';

/** Lay out native death controls using measured blocks, not leading blank text lines. */
export function layoutDeathInformation(state: KilledPlayerState): void {
  const { box, deathInfo } = state;
  if (!box || !deathInfo) return;
  const index = box.getChildIndex(deathInfo);
  if (index < 0 || index + 2 >= box.get_numChildren()) return;
  const teleport = box.getChildAt(index + 1);
  const experience = box.getChildAt(index + 2);
  if (!(experience instanceof StarlingTextField)) return;
  teleport.set_y(deathInfo.get_y() + deathInfo.get_height() + 12);
  experience.set_text(experience.get_text().replace(/^[\r\n]+/, ''));
  experience.set_y(teleport.get_y() + teleport.get_height() + 10);
  if (index + 3 < box.get_numChildren()) {
    const protection = box.getChildAt(index + 3);
    if (!(protection instanceof StarlingTextField))
      protection.set_y(experience.get_y() + experience.get_height() + 12);
  }
}

/** Original automatic respawn preference around the current game's native input. */
export function installRespawn(api: API, game: GameScene, preferences?: DeviceSettings): void {
  const reflection = new GameReflection(api);
  reflection.after(KilledPlayerState.prototype, 'enter', function () {
    if (this.g === game && this.player.isMe) layoutDeathInformation(this);
  });
  const automatic = () => preferences?.get('disableSpaceToRespawn') ?? false;
  reflection.around(RoamingState.prototype, 'updateInput', function (next) {
    // Preserve native input whenever the preference does not replace its
    // dead-player branch, including future vanilla manual-respawn changes.
    const player = this.me;
    if (this.g !== game || !player || player.get_commandable() || !automatic()) return next();
    if (player.respawnReady()) {
      player.respawnNextReady = 0;
      game.send('respawn');
    }
  });
  reflection.after(KilledPlayerState.prototype, 'execute', function () {
    if (
      this.g !== game ||
      !this.player.isMe ||
      !automatic() ||
      this.player.respawnNextReady - game.time >= 1000 ||
      game.solarSystem?.isPvpSystemInEditor
    )
      return;
    this.respawnText.set_text(
      game.isSystemTypeSurvival() && game.hud?.uberStats?.getMyLives() === 0
        ? 'Leaving...'
        : 'Respawning...',
    );
    this.respawnText.get_format().set_size(20);
    this.respawnText.alignPivot();
  });
}
