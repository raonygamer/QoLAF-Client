import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  FriendManager,
  GameScene,
  QueueInfoHolder,
  QueueManager,
  QueuePopupMessage,
  SoundLocator,
} from '../game/Bindings';

let pendingFriends = new WeakSet<FriendManager>();

function resetQueue(queue: QueueInfoHolder): void {
  queue.isWaiting = false;
  queue.isInQueue = false;
  queue.isReady = false;
  queue.accepted = false;
  queue.startTime = 0;
  queue.avgTime = 0;
  queue.roomId = null;
  queue.solarSystem = null;
  const popup = queue.acceptPopup;
  queue.acceptPopup = null;
  if (popup) {
    // Preserve removedFromStage listeners: they release keyboard/resize hooks.
    popup.removeEventListeners('accept');
    popup.removeEventListeners('close');
    popup.removeFromParent(true);
  }
}

export function disconnectServiceViews(scene: GameScene): void {
  for (const queue of scene.queueManager?.queues ?? []) resetQueue(queue);
}

export function reconnectServiceViews(scene: GameScene): void {
  const friends = scene.friendManager;
  if (friends) {
    pendingFriends.delete(friends);
    friends.updateOnlineFriends(null);
  }
  disconnectServiceViews(scene);
  const queues = scene.queueManager;
  if (queues && !scene.get_isLeaving() && scene.serviceConnection?.get_connected()) {
    scene.rpcServiceRoom('RequestQueueInfo', (message) => queues.handleQueueInfo(message));
  }
}

/** Restore read-only views after Service loss without replaying queue actions. */
export function installServiceViews(api: API): void {
  const reflection = new GameReflection(api);
  const requests = pendingFriends;
  api.defer(() => {
    // A reply can arrive while our hooks are disabled. A later activation must
    // not inherit ownership of requests it can no longer observe completing.
    if (pendingFriends === requests) pendingFriends = new WeakSet<FriendManager>();
  });
  reflection.around(FriendManager.prototype, 'updateOnlineFriends', function (_next, callback) {
    if (callback && !this.onlineFriendsCallbacks.includes(callback)) {
      this.onlineFriendsCallbacks.push(callback);
    }
    this.onlineFriendsTimer?.stop();
    this.onlineFriendsTimer = null;
    if (!this.g.serviceConnection?.get_connected()) {
      pendingFriends.delete(this);
      return;
    }
    if (pendingFriends.has(this)) return;
    pendingFriends.add(this);
    try {
      this.g.sendToServiceRoom('getOnlineFriends');
    } catch (error) {
      pendingFriends.delete(this);
      this.onlineFriendsCallbacks.length = 0;
      throw error;
    }
  });
  // Native parsing and detached callback draining already match the source.
  reflection.before(FriendManager.prototype, 'onOnlineFriends', function () {
    pendingFriends.delete(this);
  });
  reflection.around(QueueManager.prototype, 'handleQueueInfo', function (_next, message) {
    for (let index = 0; index < message.length - 2; index += 3) {
      const queue = this.getQueue(message.getString(index));
      if (!queue || !message.getBoolean(index + 1)) continue;
      queue.isInQueue = true;
      queue.isWaiting = false;
      queue.isReady = false;
      queue.accepted = false;
      queue.startTime = message.getNumber(index + 2);
    }
  });
  reflection.around(QueueInfoHolder.prototype, 'update', function () {
    if (this.g.get_isLeaving() || !this.g.serviceConnection?.get_connected()) {
      resetQueue(this);
      return;
    }
    // getTimeout may dismiss the popup, so do not dereference the old receiver.
    if (this.acceptPopup) {
      const timeout = this.getTimeout();
      this.acceptPopup?.updateTime(timeout);
    }
  });
  reflection.around(QueueInfoHolder.prototype, 'getTimeout', function (next) {
    if (this.g.get_isLeaving() || !this.g.serviceConnection?.get_connected()) {
      resetQueue(this);
      return '00';
    }
    return next();
  });
  reflection.around(QueueInfoHolder.prototype, 'createAcceptPopup', function () {
    if (this.g.get_isLeaving() || !this.g.serviceConnection?.get_connected()) {
      resetQueue(this);
      return;
    }
    if (this.acceptPopup) return;
    const popup = new QueuePopupMessage(this.type);
    this.acceptPopup = popup;
    popup.setPopupText(this.getTimeout());
    const current = () => this.acceptPopup === popup;
    const connected = () => !this.g.get_isLeaving() && this.g.serviceConnection?.get_connected();
    const sound = SoundLocator.getService();
    sound.preCacheSound('MFyIFZhNA0mso-deTlOpYg', () => {
      if (current() && connected()) sound.play('MFyIFZhNA0mso-deTlOpYg');
    });
    const choose = (accept: boolean) => {
      if (!current()) return;
      if (!connected()) return resetQueue(this);
      if (accept) {
        this.isWaiting = true;
        this.accepted = true;
      } else {
        this.isWaiting = false;
        this.isInQueue = false;
        this.isReady = false;
        this.accepted = false;
        this.startTime = 0;
      }
      this.g.sendToServiceRoom(accept ? 'acceptMatch' : 'declineMatch', [this.type]);
      popup.removeEventListeners('accept');
      popup.removeEventListeners('close');
      this.g.removeChildFromOverlay(popup, true);
      this.acceptPopup = null;
      const me = this.g.get_me();
      if (me)
        GameScene.trackEvent('pvp', 'queue', accept ? 'accepted' : 'declined', me.get_level());
    };
    popup.addEventListener('accept', () => choose(true));
    popup.addEventListener('close', () => choose(false));
    this.g.addChildToOverlay(popup);
    this.g.hud?.resize();
  });
  reflection.before(GameScene.prototype, 'handleServiceDisconnect', function () {
    disconnectServiceViews(this);
  });
  const release = (scene: GameScene) => {
    disconnectServiceViews(scene);
    if (scene.friendManager) {
      pendingFriends.delete(scene.friendManager);
      scene.friendManager.onlineFriendsTimer?.stop();
      scene.friendManager.onlineFriendsTimer = null;
      scene.friendManager.onlineFriendsCallbacks.length = 0;
    }
  };
  reflection.before(GameScene.prototype, 'exit', function () {
    release(this);
  });
  reflection.before(GameScene.prototype, 'dispose', function () {
    release(this);
  });
}
