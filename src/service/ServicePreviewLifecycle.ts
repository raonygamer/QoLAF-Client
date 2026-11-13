import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Login,
  ServiceRoomPreview,
  TweenMax,
  type Connection,
  type Message,
} from '../game/Bindings';

type Subscription = {
  connection: Connection;
  handlers: Array<[string, (message: Message) => void]>;
};

/** Original preview ownership: retire callbacks before releasing the temporary socket. */
export function installServicePreviewLifecycle(api: API): void {
  const reflection = new GameReflection(api);
  const disposed = new WeakSet<ServiceRoomPreview>();
  const active = new Set<ServiceRoomPreview>();
  const subscriptions = new Map<ServiceRoomPreview, Subscription>();
  const release = (preview: ServiceRoomPreview) => {
    const subscription = subscriptions.get(preview);
    subscriptions.delete(preview);
    const connection = subscription?.connection ?? preview.connection;
    preview.connection = null;
    if (subscription)
      for (const [type, handler] of subscription.handlers)
        subscription.connection.removeMessageHandler(type, handler);
    connection?.disconnect();
  };
  reflection.around(ServiceRoomPreview.prototype, 'join', function (next) {
    if (disposed.has(this)) return;
    active.add(this);
    const preview = this;
    // Retain native validation, protocol fields and error presentation. Capture
    // its asynchronous failure callback while this row initiates the request.
    const multiplayer = Login.client?.multiplayer;
    if (!multiplayer) return next();
    const restore = reflection.around(
      multiplayer,
      'joinRoom',
      function (request, roomId, data, success, failure) {
        return request(
          roomId,
          data,
          (connection) => {
            if (disposed.has(preview)) connection.disconnect();
            else success(connection);
          },
          (error) => {
            if (!disposed.has(preview)) failure(error);
          },
        );
      },
    );
    try {
      return next();
    } finally {
      restore();
    }
  });
  reflection.around(ServiceRoomPreview.prototype, 'joined', function (_next, connection) {
    if (disposed.has(this)) {
      connection.disconnect();
      return;
    }
    active.add(this);
    if (subscriptions.get(this)?.connection === connection) return;
    if (subscriptions.has(this)) release(this);
    this.connection = connection;
    const preview = this;
    const current = () => !disposed.has(preview) && preview.connection === connection;
    const handlers: Subscription['handlers'] = [
      [
        'onlineFriends',
        (message) => {
          if (current()) preview.onOnlineFriends(message);
        },
      ],
      [
        'preview',
        (message) => {
          if (current()) preview.onPreview(message);
        },
      ],
      [
        'error',
        (message) => {
          if (!current()) return;
          preview.friends.set_text(message.getString(0));
          preview.friends.set_color(0xff0000);
        },
      ],
    ];
    subscriptions.set(this, { connection, handlers });
    for (const [type, handler] of handlers) connection.addMessageHandler(type, handler);
  });
  reflection.around(ServiceRoomPreview.prototype, 'dispose', function (next) {
    if (disposed.has(this)) return;
    disposed.add(this);
    active.delete(this);
    TweenMax.killTweensOf(this);
    try {
      release(this);
    } finally {
      next();
    }
  });
  api.defer(() => {
    for (const preview of active) {
      disposed.add(preview);
      release(preview);
    }
    active.clear();
  });
}
