import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { Login } from '../game/Bindings';

/** Remove the login display before fallible native theme and asset cleanup. */
export function installLoginTeardown(api: API): void {
  const reflection = new GameReflection(api);
  reflection.around(Login.prototype, 'removeLoginScreen', function (next) {
    const stage = this.get_stage();
    stage?.removeEventListener('resize', reflection.bound(this, this.resize));
    stage?.removeEventListener('keyDown', reflection.bound(this, this.onKeyPress));
    stage?.removeEventListener('keyUp', reflection.bound(this, this.onKeyUp));
    try {
      this.removeEffects();
    } catch (error) {
      api.log('Login effect cleanup failed', error);
    }
    // Game and its loading cover are stage children, outside this Login root.
    this.removeChildren(0, -1, true);
    let assetsRemoved = false;
    const cleanupAssets = (removeAssets: () => void) => {
      if (assetsRemoved) return;
      assetsRemoved = true;
      try {
        removeAssets();
      } catch (error) {
        api.log('Login asset cleanup failed', error);
      }
    };
    const restoreEffects = reflection.around(this, 'removeEffects', () => {});
    const restoreAssets = reflection.around(this, 'removeEmbeddedAssets', cleanupAssets);
    try {
      // Preserve the current Haxe theme and font13 compositor initialization.
      next();
    } catch (error) {
      api.log('Gameplay theme setup failed', error);
    } finally {
      if (!assetsRemoved) this.removeEmbeddedAssets();
      restoreAssets();
      restoreEffects();
      // Native theme/font setup may throw before its own reference cleanup.
      // The source clears every disposed login display even on that path.
      this.loginContainer = null;
      this.background = null;
      this.recoverDialog = null;
      this.registerDialog = null;
      this.logoContainer = null;
      this.container = null;
    }
  });
}
