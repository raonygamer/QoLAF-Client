import type { API } from '../api/Types';
import { PlayerList, Quad, Sprite, type GameScene } from '../game/Bindings';
import { fitFriendPreviews } from './FriendPreviewLayout';

/** Keep asynchronous friend replies attached to the list that requested them. */
export function installPlayerListLifecycle(api: API, game: GameScene): void {
  const generations = new WeakMap<PlayerList, number>();
  const disposed = new WeakSet<PlayerList>();
  const previews = new Map<PlayerList, () => void>();
  const restorePreviews = (list: PlayerList) => {
    previews.get(list)?.();
    previews.delete(list);
  };
  let active = true;
  api.defer(() => {
    active = false;
    for (const list of previews.keys()) restorePreviews(list);
  });
  const invalidate = (list: PlayerList) => generations.set(list, (generations.get(list) ?? 0) + 1);

  api.before(PlayerList.prototype, 'renewListContainer', function () {
    if (this.g !== game) return;
    invalidate(this);
    restorePreviews(this);
    this.listContainer?.removeFromParent(true);
    this.listContainer = null;
    this.friendBoxes.length = 0;
    this.onlineFriends = null;
  });
  api.around(PlayerList.prototype, 'drawSystemPlayerList', function (next, event) {
    if (this.g !== game) return next(event);
    if (disposed.has(this) || (event && this.isViewingOnlineFriends)) return;
    this.isViewingOnlineFriends = false;
    return next(event);
  });
  api.around(PlayerList.prototype, 'drawOnlineFriends', function (next) {
    if (this.g !== game) return next();
    if (disposed.has(this)) return;
    const list = this;
    const manager = game.friendManager;
    if (!manager) return;
    // The native method creates its container before requesting the roster.
    // Scope this interception to that synchronous request, not other consumers.
    const remove = api.around(manager, 'updateOnlineFriends', function (request, callback) {
      const generation = generations.get(list);
      const container = list.listContainer;
      list.groupListItems = null;
      return request(() => {
        if (
          !active ||
          disposed.has(list) ||
          !list.isViewingOnlineFriends ||
          generations.get(list) !== generation ||
          list.listContainer !== container
        )
          return;
        callback?.();
        if (!container || !list.onlineFriends) return;
        restorePreviews(list);
        previews.set(list, fitFriendPreviews(list.friendBoxes));
        const padding = new Quad(25, 25, 0);
        padding.set_alpha(0);
        padding.set_touchable(false);
        padding.set_x(50);
        padding.set_y(list.friendBoxes.length * 40 + 20);
        list.onlineFriends.addChild(padding);
        container.arrange();
      });
    });
    try {
      return next();
    } finally {
      remove();
    }
  });
  api.around(PlayerList.prototype, 'dispose', function (next) {
    if (this.g !== game) return next();
    if (disposed.has(this)) return;
    disposed.add(this);
    invalidate(this);
    restorePreviews(this);
    next();
    this.friendBoxes.length = 0;
    this.groupListItems = null;
    this.onlineFriends = null;
    this.listContainer = null;
    Sprite.prototype.dispose.call(this);
  });
}
