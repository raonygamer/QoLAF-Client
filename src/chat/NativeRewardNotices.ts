import { installNativeFluxNotices } from './NativeFluxNotices';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  SceneBase,
  PodState,
  SkinItem,
  CreditPackageItem,
  Player,
  ArtifactFactory,
  type GameScene,
  type Message,
} from '../game/Bindings';
import { readNativeMessage } from '../ipc/NativeMessage';
import { ensureNativeQolafChat } from './NativeQolafChat';
import type { ClientQolafChat } from './ClientQolafChat';

export type RewardFeed = Pick<
  ClientQolafChat,
  'announcePodReward' | 'announcePurchasedSkins' | 'announceArtifactReward' | 'announcePurchase'
>;
export type CaptureRewardFeed = (game: GameScene) => RewardFeed | null;

/** Capture authenticated lifetime before callbacks; never infer rewards from UI animation or balances. */
export function installNativeRewardNotices(api: API, capture?: CaptureRewardFeed): void {
  const reflection = new GameReflection(api);
  let active = true;
  api.defer(() => {
    active = false;
  });
  const captureFeed: CaptureRewardFeed =
    capture ??
    ((game) => {
      const me = game.get_me();
      if (
        !active ||
        api.game !== game ||
        game.get_isLeaving() ||
        !me ||
        game.client?.connectUserId !== me.id
      )
        return null;
      return ensureNativeQolafChat(api, me.id, me.get_name());
    });
  installNativeFluxNotices(api, captureFeed);
  type Scope = {
    game: GameScene;
    feed: RewardFeed;
    kind: 'pod' | 'skins';
    rpc: string;
    operation: Record<string, unknown>;
  };
  let scope: Scope | null = null;
  const scoped = <T>(game: GameScene, kind: Scope['kind'], rpc: string, invoke: () => T) => {
    const previous = scope;
    const feed = active ? captureFeed(game) : null;
    scope = feed
      ? { game, kind, rpc, feed, operation: { type: kind === 'pod' ? 'openPod' : rpc } }
      : null;
    try {
      return invoke();
    } finally {
      scope = previous;
    }
  };
  const report = (operation: Scope, message: Message) => {
    if (!active) return;
    try {
      const reply = readNativeMessage(message);
      if (!reply || reply.type !== operation.rpc) return;
      if (operation.kind === 'pod') operation.feed.announcePodReward(reply, operation.operation);
      else operation.feed.announcePurchasedSkins(reply, operation.operation);
    } catch {
      /* A notice cannot interrupt authoritative reward presentation. */
    }
  };
  const Scene = SceneBase.prototype;
  reflection.around(Scene, 'rpc', function (next, type, callback, ...args) {
    const operation = scope;
    if (
      !operation ||
      operation.game !== this ||
      operation.rpc !== type ||
      typeof callback !== 'function'
    )
      return next(type, callback, ...args);
    return next(
      type,
      function (this: unknown, message: Message) {
        report(operation, message);
        return callback.call(this, message);
      },
      ...args,
    );
  });
  reflection.around(Scene, 'rpcMessage', function (next, message, callback, ...args) {
    const operation = scope;
    if (
      !operation ||
      operation.game !== this ||
      operation.rpc !== message.type ||
      typeof callback !== 'function'
    )
      return next(message, callback, ...args);
    return next(
      message,
      function (this: unknown, reply: Message) {
        report(operation, reply);
        return callback.call(this, reply);
      },
      ...args,
    );
  });
  const Pod = PodState.prototype;
  reflection.around(Pod, 'createClickOpenPod', function (next, ...args) {
    const click = next(...args);
    const game = this.g;
    if (typeof click !== 'function') return click;
    return function (this: unknown) {
      return scoped(game, 'pod', 'openPod', () => click.call(this));
    };
  });
  const Skin = SkinItem.prototype;
  reflection.around(Skin, 'onBuy', function (next, ...args) {
    return scoped(this.g, 'skins', 'buySkin', () => next(...args));
  });
  const Package = CreditPackageItem.prototype;
  reflection.around(Package, 'onClose', function (next, ...args) {
    if (typeof this.rpcFunction !== 'string' || !this.rpcFunction) return next(...args);
    return scoped(this.g, 'skins', this.rpcFunction, () => next(...args));
  });

  let artifactLoad: { game: GameScene; player: Player; feed: RewardFeed } | null = null;
  const playerPrototype = Player.prototype;
  reflection.around(
    playerPrototype,
    'loadArtifactsFromMessage',
    function (next, message, index, isLoot = false, ...args) {
      const previous = artifactLoad;
      const me = this.g.get_me();
      const feed =
        active &&
        isLoot === true &&
        this.isMe &&
        this.id === this.g.client?.connectUserId &&
        this === me
          ? captureFeed(this.g)
          : null;
      artifactLoad = feed ? { game: this.g, player: this, feed } : null;
      try {
        return next(message, index, isLoot, ...args);
      } finally {
        artifactLoad = previous;
      }
    },
  );
  reflection.around(
    ArtifactFactory,
    'createArtifact',
    function (next, id, game, player, callback, ...args) {
      const load = artifactLoad;
      if (!load || load.game !== game || load.player !== player || typeof callback !== 'function')
        return next(id, game, player, callback, ...args);
      return next(
        id,
        game,
        player,
        function (this: unknown, artifact) {
          if (active && artifact) {
            try {
              load.feed.announceArtifactReward({
                id: artifact.id,
                name: artifact.name,
                level: artifact.level,
                isUnique: artifact.get_isUnique(),
              });
            } catch {
              /* Keep the native inventory update even if notification fails. */
            }
          }
          return callback.call(this, artifact);
        },
        ...args,
      );
    },
  );
}
