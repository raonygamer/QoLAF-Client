import { read, type API, type Raw } from '../api/Types';

/** Original RoamingState input branch and Killed prompt for automatic respawn. */
export function installRespawn(api: API, game: Raw): void {
  const settings = () => api.cls('core.scene.SceneBase')?.settings;
  const roaming = api.cls('core.states.gameStates.RoamingState')?.prototype;
  if (typeof roaming?.updateInput === 'function') {
    api.around(roaming, 'updateInput', function (next) {
      if (this.g !== game || read(this.me, 'commandable')) return next();
      if (
        this.me.respawnReady() &&
        (settings()?.disableSpaceToRespawn || this.input.isKeyPressed(32))
      ) {
        this.me.respawnNextReady = 0;
        game.send('respawn');
      }
    });
  }
  const killed = api.cls('core.states.player.Killed')?.prototype;
  if (typeof killed?.execute === 'function') {
    api.after(killed, 'execute', function () {
      if (
        this.g !== game ||
        !this.player.isMe ||
        !settings()?.disableSpaceToRespawn ||
        this.player.respawnNextReady - game.time >= 1000 ||
        game.solarSystem.isPvpSystemInEditor
      )
        return;
      this.respawnText.set_text(
        game.isSystemTypeSurvival() && game.hud.uberStats.getMyLives() === 0
          ? 'Leaving...'
          : 'Respawning...',
      );
      this.respawnText.get_format().set_size(20);
      this.respawnText.alignPivot();
    });
  }
}
