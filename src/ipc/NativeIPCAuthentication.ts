import { ClientQolafChat } from '../chat/ClientQolafChat';
import { ensureNativeQolafChat } from '../chat/NativeQolafChat';
import type { API } from '../api/Types';
import type {} from '../game/LoginLoading';
import { GameReflection } from '../api/GameReflection';
import {
  JoinRoomManager,
  Login,
  SceneBase,
  RymdenRunt,
  MessageLog,
  MD5,
  type Client,
  type Room,
} from '../game/Bindings';
import { CLIENT_BUILD, CLIENT_VERSION, CLIENT_REVISION } from '../login/LoginIdentity';
import { ClientIPCService, type IPCEnvironment } from './ClientIPCService';
import { NativeIPCClient } from './NativeIPCClient';
import { ClientIPCEcho } from './ClientIPCEcho';
import { EmperorReadyNotifier } from './EmperorReadyNotifier';

/** Lifetime belongs to the authenticated client, not a disposable Game session. */
export function installNativeIPCAuthentication(
  api: API,
  events?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  environment?: IPCEnvironment,
): void {
  const reflection = new GameReflection(api);
  const manager = JoinRoomManager;
  const pageEvents = events ?? window;
  // Preserve the original reserved slot while following the active service release.
  const serviceId = manager.getServiceRoomID(0);
  const match = /^Service-(\d+)_0$/.exec(serviceId);
  const serverVersion = match ? Number(match[1]) : undefined;
  if (serverVersion === undefined) return;
  const previousServerVersion = ClientIPCService.serverVersion;
  ClientIPCService.setServerVersion(serverVersion);
  api.defer(() => {
    if (ClientIPCService.serverVersion === serverVersion)
      ClientIPCService.setServerVersion(previousServerVersion);
  });
  const classes: Record<string, unknown> | undefined = api.raw?.classes ?? undefined;
  if (classes) {
    for (const [name, type] of [
      ['core.ipc.ClientIPCService', ClientIPCService],
      ['core.ipc.ClientIPCEcho', ClientIPCEcho],
      ['core.ipc.EmperorReadyNotifier', EmperorReadyNotifier],
      ['core.hud.components.chat.ClientQolafChat', ClientQolafChat],
    ] as const) {
      const previous = Object.getOwnPropertyDescriptor(classes, name);
      classes[name] = type;
      api.defer(() => {
        if (classes[name] !== type) return;
        if (previous) Object.defineProperty(classes, name, previous);
        else delete classes[name];
      });
    }
  }
  const adapters = new WeakMap<Client, NativeIPCClient>();
  let owner: Client | null = null;
  let disposed = false;
  // QIPC discovery uses the client release and public/private build identity.
  const version = `${CLIENT_VERSION.split('-')[0]} (${CLIENT_BUILD})`;
  const serviceEnvironment: IPCEnvironment = environment ?? {
    now: () => performance.now(),
    random: () => Math.random(),
    interval: (callback, ms) => {
      const timer = setInterval(callback, ms);
      return () => clearInterval(timer);
    },
    defer: (callback) => {
      setTimeout(callback, 0);
    },
    debug: (text) => MessageLog.write(text, 'debug'),
  };
  const ensure = (client: Client | null | undefined) => {
    if (disposed || !client?.connectUserId) return;
    let adapter = adapters.get(client);
    if (!adapter) {
      adapter = new NativeIPCClient(client);
      adapters.set(client, adapter);
    }
    owner = client;
    const ipc = ClientIPCService.ensure(adapter, version, serviceEnvironment);
    ClientIPCEcho.ensure(ipc, CLIENT_REVISION, serverVersion, serviceEnvironment, (text) =>
      MD5.hash(text),
    );
    ensureNativeQolafChat(api, client.connectUserId);
  };
  const shutdown = () => {
    owner = null;
    ClientIPCService.shutdown();
  };
  const reportReserved = (instance: JoinRoomManager) => {
    const text = ClientIPCService.reservedMessage;
    const login = instance.login;
    if (typeof login?.showRoomConnectionStatus === 'function') login.showRoomConnectionStatus(text);
    else if (typeof login?.updateStatus === 'function') login.updateStatus(text);
    MessageLog.write(text, 'error');
  };
  const reserved = (room: Pick<Room, 'id' | 'data'> | null | undefined) =>
    room?.id === ClientIPCService.roomId ||
    room?.data?.service === ClientIPCService.roomId ||
    room?.data?.primaryService === ClientIPCService.roomId;

  reflection.around(manager, 'isValidServiceRoomId', (next, id) =>
    id === ClientIPCService.roomId ? false : next(id),
  );
  reflection.around(manager.prototype, 'joinServiceRoom', function (next, id) {
    if (id === ClientIPCService.roomId) return reportReserved(this);
    return next(id);
  });
  reflection.around(manager.prototype, 'joinServiceRoomAttempt', function (next, id, retry) {
    if (id === ClientIPCService.roomId) return reportReserved(this);
    return next(id, retry);
  });
  // Room listings and explicit desired IDs both reach createJoin. Filtering
  // alone would still allow a remembered/direct destination into IPC.
  reflection.around(manager.prototype, 'handleRooms', function (next, rooms) {
    return next(rooms.filter((room) => !reserved(room)));
  });
  reflection.around(manager.prototype, 'createJoin', function (next, ...args) {
    if (reserved(this.room)) {
      reportReserved(this);
      return;
    }
    return next(...args);
  });
  reflection.after(manager.prototype, 'onJoinedServiceRoom', function () {
    if (
      this.serviceConnection?.get_connected() &&
      this.serviceConnection.get_roomId() !== ClientIPCService.roomId
    )
      ensure(this.client);
  });
  reflection.around(
    manager.prototype,
    'reconnectServiceRoom',
    function (next, id, success, failure) {
      // The recovery implementation owns rejection and rollback policy. Let it
      // deliver failure rather than leaving its caller waiting for a callback.
      if (id === ClientIPCService.roomId) reportReserved(this);
      return next(
        id,
        (connection) => {
          ensure(this.client);
          success(connection);
        },
        failure,
      );
    },
  );
  reflection.before(Login.prototype, 'init', shutdown);
  reflection.before(SceneBase.prototype, 'duplicateLogin', shutdown);
  reflection.before(RymdenRunt.prototype, 'onExitGame', shutdown);

  // Hot activation after the primary handshake must not wait for a warp.
  const game = reflection.is(api.game, 'core.scene.Game') ? api.game : null;
  if (
    game &&
    game.serviceConnection?.get_connected() &&
    game.serviceConnection.get_roomId() !== ClientIPCService.roomId
  )
    ensure(game.client);
  const pageHide = () => {
    ClientIPCService.shutdown();
  };
  const pageShow = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) ensure(owner);
  };
  pageEvents.addEventListener('pagehide', pageHide);
  pageEvents.addEventListener('pageshow', pageShow);
  api.defer(() => {
    disposed = true;
    pageEvents.removeEventListener('pagehide', pageHide);
    pageEvents.removeEventListener('pageshow', pageShow);
    shutdown();
  });
}
