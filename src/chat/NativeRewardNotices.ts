import { installNativeFluxNotices } from './NativeFluxNotices';
import { read, type API, type Raw } from '../api/Types';
import { readNativeMessage } from '../ipc/NativeMessage';
import { ensureNativeQolafChat } from './NativeQolafChat';
import type { ClientQolafChat } from './ClientQolafChat';

export type RewardFeed = Pick<
  ClientQolafChat,
  'announcePodReward' | 'announcePurchasedSkins' | 'announceArtifactReward' | 'announcePurchase'
>;
export type CaptureRewardFeed = (game: Raw) => RewardFeed | null;

/** Capture authenticated lifetime before callbacks; never infer rewards from UI animation or balances. */
export function installNativeRewardNotices(api: API, capture?: CaptureRewardFeed): void {
  let active = true;
  api.defer(() => {
    active = false;
  });
  const captureFeed: CaptureRewardFeed =
    capture ??
    ((game) => {
      const me = read(game, 'me');
      if (
        !active ||
        api.game !== game ||
        game.isLeaving ||
        !me ||
        game.client?.connectUserId !== me.id
      )
        return null;
      return ensureNativeQolafChat(api, me.id, read(me, 'name', ''));
    });
  installNativeFluxNotices(api, captureFeed);
  type Scope = {
    game: Raw;
    feed: RewardFeed;
    kind: 'pod' | 'skins';
    rpc: string;
    operation: Record<string, unknown>;
  };
  let scope: Scope | null = null;
  const scoped = (game: Raw, kind: Scope['kind'], rpc: string, invoke: () => any) => {
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
  const report = (operation: Scope, message: Raw) => {
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
  const Scene = api.cls('core.scene.SceneBase')?.prototype;
  if (Scene?.rpc)
    api.around(Scene, 'rpc', function (next, type, callback, ...args) {
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
        function (this: unknown, message: Raw, ...values: unknown[]) {
          report(operation, message);
          return callback.call(this, message, ...values);
        },
        ...args,
      );
    });
  if (Scene?.rpcMessage)
    api.around(Scene, 'rpcMessage', function (next, message, callback, ...args) {
      const operation = scope;
      if (
        !operation ||
        operation.game !== this ||
        operation.rpc !== read(message, 'type') ||
        typeof callback !== 'function'
      )
        return next(message, callback, ...args);
      return next(
        message,
        function (this: unknown, reply: Raw, ...values: unknown[]) {
          report(operation, reply);
          return callback.call(this, reply, ...values);
        },
        ...args,
      );
    });
  const Pod = api.cls('core.states.gameStates.PodState')?.prototype;
  if (Pod?.createClickOpenPod)
    api.around(Pod, 'createClickOpenPod', function (next, ...args) {
      const click = next(...args);
      const game = this.g;
      if (typeof click !== 'function') return click;
      return function (this: unknown, ...values: unknown[]) {
        return scoped(game, 'pod', 'openPod', () => click.apply(this, values));
      };
    });
  const Skin = api.cls('core.hud.components.hangar.SkinItem')?.prototype;
  if (Skin?.onBuy)
    api.around(Skin, 'onBuy', function (next, ...args) {
      return scoped(this.g, 'skins', 'buySkin', () => next(...args));
    });
  const Package = api.cls('core.hud.components.credits.CreditPackageItem')?.prototype;
  if (Package?.onClose)
    api.around(Package, 'onClose', function (next, ...args) {
      if (typeof this.rpcFunction !== 'string' || !this.rpcFunction) return next(...args);
      return scoped(this.g, 'skins', this.rpcFunction, () => next(...args));
    });

  let artifactLoad: { game: Raw; player: Raw; feed: RewardFeed } | null = null;
  const Player = api.cls('core.player.Player')?.prototype;
  const ArtifactFactory = api.cls('core.artifact.ArtifactFactory');
  if (Player?.loadArtifactsFromMessage && ArtifactFactory?.createArtifact) {
    api.around(
      Player,
      'loadArtifactsFromMessage',
      function (next, message, index, isLoot = false, ...args) {
        const previous = artifactLoad;
        const me = read(this.g, 'me');
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
    api.around(
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
          function (this: unknown, artifact: Raw | null, ...values: unknown[]) {
            if (active && artifact) {
              try {
                load.feed.announceArtifactReward({
                  id: read(artifact, 'id'),
                  name: read(artifact, 'name'),
                  level: read(artifact, 'level'),
                  isUnique: read(artifact, 'isUnique', false),
                });
              } catch {
                /* Keep the native inventory update even if notification fails. */
              }
            }
            return callback.call(this, artifact, ...values);
          },
          ...args,
        );
      },
    );
  }
}
