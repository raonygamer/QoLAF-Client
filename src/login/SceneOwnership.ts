import type { API } from '../api/Types';
import { GameScene, SceneStateMachine } from '../game/Bindings';

/** Keep legacy singleton consumers attached to the room whose lifecycle is running. */
export function installSceneOwnership(api: API): void {
  api.around(SceneStateMachine.prototype, 'changeRoom', function (next, room) {
    const previous = this.currentRoom instanceof GameScene ? this.currentRoom : null;
    const incoming = room instanceof GameScene ? room : null;
    if (previous) GameScene.instance = previous;
    const release = api.after(this.stage, 'removeChild', function (_result, child) {
      if (child === previous && GameScene.instance === previous) GameScene.instance = null;
    });
    const publish = api.before(this.stage, 'addChild', function (child) {
      if (Object.is(child, room) && incoming) GameScene.instance = incoming;
    });
    try {
      return next(room);
    } finally {
      publish();
      release();
    }
  });
  api.around(SceneStateMachine.prototype, 'closeCurrentRoom', function (next) {
    const closing = this.currentRoom instanceof GameScene ? this.currentRoom : null;
    const result = next();
    if (closing && GameScene.instance === closing) GameScene.instance = null;
    return result;
  });
}
