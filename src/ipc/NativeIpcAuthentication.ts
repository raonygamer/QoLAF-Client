import { ClientQolafChat } from '../chat/ClientQolafChat';
import { ensureNativeQolafChat } from '../chat/NativeQolafChat';
import { read, type API, type Raw } from '../api/Types';
import { CLIENT_VERSION } from '../login/LoginIdentity';
import { ClientIpcService, type IpcEnvironment } from './ClientIpcService';
import { NativeIpcClient } from './NativeIpcClient';

/** Lifetime belongs to the authenticated client, not a disposable Game session. */
export function installNativeIpcAuthentication(
  api: API,
  events?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  environment?: IpcEnvironment,
): void {
  const manager = api.cls('joinRoom.JoinRoomManager');
  if (!manager) return;
  const pageEvents = events ?? window;
  // Preserve the original reserved slot while following the active service release.
  const serviceId = manager.getServiceRoomID(0);
  const match = /^Service-(\d+)_0$/.exec(serviceId);
  const serverVersion = match ? Number(match[1]) : undefined;
  if (serverVersion === undefined) return;
  const previousServerVersion = ClientIpcService.serverVersion;
  ClientIpcService.setServerVersion(serverVersion);
  api.defer(() => {
    if (ClientIpcService.serverVersion === serverVersion)
      ClientIpcService.setServerVersion(previousServerVersion);
  });
  const classes = api.raw?.classes;
  if (classes) {
    for (const [name, type] of [
      ['core.ipc.ClientIpcService', ClientIpcService],
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
  const adapters = new WeakMap<Raw, NativeIpcClient>();
  let owner: Raw | null = null;
  let disposed = false;
  // QIPC discovery accepts release triples. Do not advertise the AS3 source
  // version: development status remains explicit in the port's login label.
  const version = `${CLIENT_VERSION.split('-')[0]} (Public)`;
  const serviceEnvironment: IpcEnvironment = environment ?? {
    now: () => performance.now(),
    random: () => Math.random(),
    interval: (callback, ms) => {
      const timer = setInterval(callback, ms);
      return () => clearInterval(timer);
    },
    defer: (callback) => {
      setTimeout(callback, 0);
    },
    debug: (text) => api.cls('core.hud.components.chat.MessageLog')?.write(text, 'debug'),
  };
  const ensure = (client: Raw | null | undefined) => {
    if (disposed || !client?.connectUserId) return;
    let adapter = adapters.get(client);
    if (!adapter) {
      adapter = new NativeIpcClient(client);
      adapters.set(client, adapter);
    }
    owner = client;
    ClientIpcService.ensure(adapter, version, serviceEnvironment);
    ensureNativeQolafChat(api, client.connectUserId);
  };
  const shutdown = () => {
    owner = null;
    ClientIpcService.shutdown();
  };
  const reportReserved = (instance: Raw) => {
    const text = ClientIpcService.reservedMessage;
    const login = instance.login;
    if (typeof login?.showRoomConnectionStatus === 'function') login.showRoomConnectionStatus(text);
    else if (typeof login?.updateStatus === 'function') login.updateStatus(text);
    api.cls('core.hud.components.chat.MessageLog')?.write(text, 'error');
  };
  const reserved = (room: Raw | null | undefined) =>
    room?.id === ClientIpcService.roomId ||
    room?.data?.service === ClientIpcService.roomId ||
    room?.data?.primaryService === ClientIpcService.roomId;

  api.around(manager, 'isValidServiceRoomId', (next, id) =>
    id === ClientIpcService.roomId ? false : next(id),
  );
  for (const method of ['joinServiceRoom', 'joinServiceRoomAttempt', 'reconnectServiceRoom']) {
    if (typeof manager.prototype[method] !== 'function') continue;
    api.around(manager.prototype, method, function (next, id, ...args) {
      if (id === ClientIpcService.roomId) {
        reportReserved(this);
        return;
      }
      return next(id, ...args);
    });
  }
  // Room listings and explicit desired IDs both reach createJoin. Filtering
  // alone would still allow a remembered/direct destination into IPC.
  api.around(manager.prototype, 'handleRooms', function (next, rooms: Raw[]) {
    return next(rooms.filter((room) => !reserved(room)));
  });
  api.around(manager.prototype, 'createJoin', function (next, ...args) {
    if (reserved(this.room)) {
      reportReserved(this);
      return;
    }
    return next(...args);
  });
  api.after(manager.prototype, 'onJoinedServiceRoom', function () {
    if (
      read(this.serviceConnection, 'connected', false) &&
      read(this.serviceConnection, 'roomId') !== ClientIpcService.roomId
    )
      ensure(this.client);
  });
  if (typeof manager.prototype.reconnectServiceRoom === 'function') {
    api.around(manager.prototype, 'reconnectServiceRoom', function (next, id, success, failure) {
      return next(
        id,
        (connection: Raw) => {
          ensure(this.client);
          success(connection);
        },
        failure,
      );
    });
  }
  const login = api.cls('Login')?.prototype;
  if (login?.init) api.before(login, 'init', shutdown);
  const scene = api.cls('core.scene.SceneBase')?.prototype;
  if (scene?.duplicateLogin) api.before(scene, 'duplicateLogin', shutdown);
  const root = api.cls('RymdenRunt')?.prototype;
  if (root?.onExitGame) api.before(root, 'onExitGame', shutdown);

  // Hot activation after the primary handshake must not wait for a warp.
  const game = api.game;
  if (
    game &&
    read(game.serviceConnection, 'connected', false) &&
    read(game.serviceConnection, 'roomId') !== ClientIpcService.roomId
  )
    ensure(game.client);
  const pageHide = () => {
    ClientIpcService.shutdown();
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
