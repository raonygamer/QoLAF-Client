import type {} from '../game/LoginLoading';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Login,
  Preload,
  JoinRoomManager,
  JoinRoomLocator,
  RymdenRunt,
  Util,
  EmbeddedAssets,
  DataLocator,
  StartSetup,
  Localize,
  type Event,
} from '../game/Bindings';
import { LoginLoadingStatus } from './LoginLoadingStatus';
import { StartupServiceJoin } from './StartupServiceJoin';
import { installLoginTeardown } from './LoginTeardown';
import { ClientIPCService } from '../ipc/ClientIPCService';
import type { ServicePlayerInfo } from '../game/ServicePlayerInfo';

interface LoadingAttempt {
  login: Login;
  texturesReady: boolean;
  cacheReady: boolean;
  serviceReady: boolean;
  roomsReady: boolean;
  scanning: boolean;
  completed: boolean;
  failed: boolean;
  manager?: JoinRoomManager;
  status?: LoginLoadingStatus;
  serviceJoin?: StartupServiceJoin;
  detachJoined?: () => void;
  playerInfo?: ServicePlayerInfo;
}

/** Login.diff: overlap assets, service discovery and returning-player room scan. */
export function installLoginLoading(api: API): void {
  installLoginTeardown(api);
  const reflection = new GameReflection(api);
  const preload = Preload.prototype;
  const manager = JoinRoomManager.prototype;
  const attempts = new WeakMap<Login, LoadingAttempt>();
  const preloads = new WeakMap<Preload, LoadingAttempt>();
  let authenticating: LoadingAttempt | undefined;
  let disposed = false;
  const loginPrototype = Login.prototype;
  const previousStatus = Object.getOwnPropertyDescriptor(
    loginPrototype,
    'showRoomConnectionStatus',
  );
  const previousRetry = Object.getOwnPropertyDescriptor(loginPrototype, 'showRoomConnectionRetry');
  const showStatus = function (this: Login, status: string, retryStatus = ''): void {
    const attempt = attempts.get(this);
    if (attempt && isCurrent(attempt) && !attempt.completed)
      attempt.status?.setNetwork(status, retryStatus);
  };
  const showRetry = function (this: Login, status: string): void {
    const attempt = attempts.get(this);
    if (attempt && isCurrent(attempt) && !attempt.completed) attempt.status?.setDetail(status);
  };
  Object.defineProperties(loginPrototype, {
    showRoomConnectionStatus: { configurable: true, writable: true, value: showStatus },
    showRoomConnectionRetry: { configurable: true, writable: true, value: showRetry },
  });
  api.defer(() => {
    if (loginPrototype.showRoomConnectionStatus === showStatus) {
      if (previousStatus)
        Object.defineProperty(loginPrototype, 'showRoomConnectionStatus', previousStatus);
      else Reflect.deleteProperty(loginPrototype, 'showRoomConnectionStatus');
    }
    if (loginPrototype.showRoomConnectionRetry === showRetry) {
      if (previousRetry)
        Object.defineProperty(loginPrototype, 'showRoomConnectionRetry', previousRetry);
      else Reflect.deleteProperty(loginPrototype, 'showRoomConnectionRetry');
    }
  });
  api.defer(() => {
    disposed = true;
  });

  const isCurrent = (attempt: LoadingAttempt) =>
    !disposed &&
    !attempt.failed &&
    attempts.get(attempt.login) === attempt &&
    (!attempt.manager || JoinRoomLocator.getService() === attempt.manager);

  const failLoading = (attempt: LoadingAttempt) => {
    if (!isCurrent(attempt) || attempt.completed) return;
    // Close the network branch before any late response can resume scanning.
    attempt.failed = true;
    attempt.detachJoined?.();
    attempt.serviceJoin?.cancel();
    const manager = attempt.manager;
    if (manager) {
      manager.stopServicePing();
      manager.serviceConnection?.disconnect();
    }
    attempt.status?.setNetwork('Loading failed. Please reload the page.');
  };

  const finish = (attempt: LoadingAttempt) => {
    const login = attempt.login;
    const playerInfo = attempt.playerInfo;
    if (
      !isCurrent(attempt) ||
      attempt.completed ||
      !attempt.cacheReady ||
      !attempt.texturesReady ||
      !attempt.serviceReady ||
      !playerInfo
    )
      return;
    if (playerInfo.level > 0 && !attempt.roomsReady) return;
    attempt.completed = true;
    // The original puts the game loading cover up before tearing down login.
    if (playerInfo.level > 0) login.joinGameRoom();
    attempt.status?.dispose();
    login.removeLoginScreen();
    if (playerInfo.level === 0) login.initStartSetup();
  };

  const scan = (attempt: LoadingAttempt) => {
    const playerInfo = attempt.playerInfo;
    if (
      !isCurrent(attempt) ||
      !attempt.cacheReady ||
      !attempt.serviceReady ||
      attempt.scanning ||
      attempt.roomsReady ||
      attempt.completed ||
      !playerInfo
    )
      return;
    if (playerInfo.level > 0) {
      attempt.status?.setNetwork('Scanning game rooms...');
      attempt.scanning = true;
      attempt.manager!.joinCurrentSolarSystem();
    } else attempt.status?.setNetwork('Preparing game...');
    finish(attempt);
  };

  reflection.around(Login.prototype, 'handleConnect', function (next, ...args) {
    if (this.isLoggedIn) return next(...args);
    const attempt: LoadingAttempt = {
      login: this,
      texturesReady: false,
      cacheReady: false,
      serviceReady: false,
      roomsReady: false,
      scanning: false,
      completed: false,
      failed: false,
    };
    attempts.set(this, attempt);
    const previous = authenticating;
    authenticating = attempt;
    try {
      return next(...args);
    } finally {
      authenticating = previous;
    }
  });

  reflection.around(preload, 'loadData', function (next, ...args) {
    const attempt = authenticating;
    if (!attempt || attempt.login.preload !== this || disposed) return next(...args);
    preloads.set(this, attempt);
    attempt.status = new LoginLoadingStatus(this.loadingBar);
    attempt.status.setInterfaceLoading(true);
    api.defer(() => attempt.status?.dispose());
    const login = attempt.login;
    if (Login.currentState === 'steam') {
      const name = RymdenRunt?.info?.name;
      login.joinData.name = Util.trimUsername(name);
    }
    // QoLAF starts Service before parsing the common cache. A synchronous
    // response may record playerInfo, but scan() waits for cacheReady.
    login.joinServiceRoom();
    login.connectStatus.set_visible(false);

    const textures = this.textureManager;
    const progress = (event: Event) => {
      if (isCurrent(attempt)) this.onImagePreloadProgress(event);
    };
    const complete = (event: Event) => {
      detach();
      if (isCurrent(attempt)) this.onImagePreloadComplete(event);
    };
    const failed = (event: Event) => {
      detach();
      if (!isCurrent(attempt)) return;
      try {
        this.onImagePreloadFailed(event);
      } finally {
        failLoading(attempt);
      }
    };
    const detach = () => {
      textures.removeEventListener('preloadProgress', progress);
      textures.removeEventListener('preloadComplete', complete);
      textures.removeEventListener('preloadFailed', failed);
      textures.removeEventListener('preloadError', failed);
    };
    textures.addEventListener('preloadProgress', progress);
    textures.addEventListener('preloadComplete', complete);
    textures.addEventListener('preloadFailed', failed);
    textures.addEventListener('preloadError', failed);
    api.defer(detach);
    textures.loadTextures([
      'texture_gui1_test.xml',
      'texture_gui1_test.png',
      'texture_gui2.xml',
      'texture_gui2.png',
      'texture_main_NEW.xml',
      'texture_main_NEW.png',
      'texture_body.xml',
      'texture_body.png',
    ]);
    if (!isCurrent(attempt)) return;
    const embeddedComplete = () => {
      if (!isCurrent(attempt)) return;
      attempt.status?.setInterfaceLoading(false);
      this.embeddedLoaded = true;
      this.finishIfReady();
    };
    // Haxe's embedded UI library is an additional real dependency. Preserve
    // its existing error policy and readiness gate while overlapping requests.
    EmbeddedAssets.loadLibrary(embeddedComplete, (error: unknown) => {
      if (!isCurrent(attempt)) return;
      api.log('Embedded assets failed', error);
      embeddedComplete();
    });
    DataLocator.getService().cacheCommonData();
    attempt.cacheReady = true;
    scan(attempt);
  });
  reflection.after(preload, 'onImagePreloadProgress', function () {
    preloads.get(this)?.status?.updateTextures(this.textureManager.get_percLoaded());
  });
  reflection.before(preload, 'onImagePreloadComplete', function () {
    preloads.get(this)?.status?.completeTextures();
  });
  reflection.around(preload, 'preloadComplete', function (next, ...args) {
    const attempt = preloads.get(this);
    if (!attempt) return next(...args);
    // The source keeps network status visible after images complete and signals
    // readiness immediately. The native Haxe fade delays this by 300 ms.
    if (isCurrent(attempt)) this.dispatchEventWith('preloadComplete');
  });
  reflection.around(Login.prototype, 'preloadComplete', function (next, ...args) {
    const attempt = attempts.get(this);
    if (!attempt) return next(...args);
    if (!isCurrent(attempt) || attempt.completed) return;
    this.preload?.removeEventListener(
      'preloadComplete',
      reflection.bound(this, this.preloadComplete),
    );
    attempt.texturesReady = true;
    finish(attempt);
  });

  reflection.around(Login.prototype, 'joinServiceRoom', function (next, ...args) {
    const attempt = attempts.get(this);
    if (!attempt) return next(...args);
    if (!isCurrent(attempt) || attempt.manager) return;
    const client = Login.client;
    if (!client) throw new Error('Cannot start service discovery before authentication.');
    Login.setDevServer(client);
    const stage = this.get_stage();
    if (!stage) throw new Error('Cannot start service discovery without the login stage.');
    const instance = new JoinRoomManager(client, stage, this.joinData, this);
    this.joinRoomManager = instance;
    attempt.manager = instance;
    JoinRoomLocator.register(instance);
    const joined = (event: Event & { data: ServicePlayerInfo }) => {
      instance.removeEventListener('joinedServiceRoom', joined);
      if (isCurrent(attempt)) this.onJoinedServiceRoom(event);
    };
    // Install before init: discovery/join callbacks can complete immediately
    // when the runtime reuses a connection or cached room information.
    instance.addEventListener('joinedServiceRoom', joined);
    attempt.detachJoined = () => instance.removeEventListener('joinedServiceRoom', joined);
    api.defer(attempt.detachJoined);
    instance.init();
  });

  reflection.around(Login.prototype, 'onJoinedServiceRoom', function (next, event) {
    const attempt = attempts.get(this);
    if (!attempt) return next(event);
    if (!isCurrent(attempt) || attempt.completed || attempt.serviceReady) return;
    const sound = this.soundManager;
    if (!attempt.manager || !sound)
      throw new Error('Service joined before login services were initialized.');
    this.playerInfo = event.data;
    attempt.playerInfo = event.data;
    attempt.serviceReady = true;
    sound.set_musicVolume(event.data.musicVolume);
    sound.set_effectVolume(event.data.effectVolume);
    scan(attempt);
  });

  reflection.around(manager, 'init', function (next) {
    const attempt = attempts.get(this.login);
    if (!attempt || attempt.manager !== this) return next();
    if (!isCurrent(attempt)) return;
    // Keep native initialization, filtering and capacity policy. Only the
    // callbacks created during this manager's initial service listing belong
    // to this attempt; do not suppress later in-game room-list requests.
    const restore = reflection.around(
      this.client.multiplayer,
      'listRooms',
      function (list, roomType, criteria, limit, offset, success, failure) {
        if (roomType !== 'service')
          return list(roomType, criteria, limit, offset, success, failure);
        return list(
          roomType,
          criteria,
          limit,
          offset,
          (rooms) => {
            if (isCurrent(attempt)) success(rooms);
          },
          (error) => {
            if (isCurrent(attempt)) failure(error);
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

  reflection.around(manager, 'handleServiceRooms', function (next, rooms) {
    const attempt = attempts.get(this.login);
    if (!attempt || attempt.manager !== this) return next(rooms);
    if (!isCurrent(attempt) || attempt.completed) return;
    StartSetup.showProgressText(Localize.t('Joining service room'));
    const available = rooms.filter(
      (room) =>
        room.id !== ClientIPCService.roomId &&
        JoinRoomManager.isValidServiceRoomId(room.id) &&
        Number.parseInt(room.id.slice(8, 12), 10) >= ClientIPCService.serverVersion,
    );
    let selected = false;
    const choose = (roomId: string) => {
      if (selected || !isCurrent(attempt) || attempt.completed) return;
      selected = true;
      this.joinServiceRoom(roomId);
    };
    // QoLAF intentionally shows the chooser at 40 users; native Haxe waits
    // until 195. Keep the current game's room-ID validation and join protocol.
    if (!available.length) choose(JoinRoomManager.getServiceRoomID(0));
    else if (available.length === 1 && available[0]!.onlineUsers < 40) choose(available[0]!.id);
    else this.login.selectServiceRoom(available, choose);
  });

  reflection.around(manager, 'joinServiceRoomAttempt', function (next, roomId: string, retry = 0) {
    const attempt = attempts.get(this.login);
    if (!attempt) return next(roomId, retry);
    if (!isCurrent(attempt)) return;
    if (attempt.completed) return next(roomId, retry);
    if (!attempt.serviceJoin) {
      attempt.serviceJoin = new StartupServiceJoin(
        this,
        attempt.status,
        () => isCurrent(attempt) && !attempt.completed && JoinRoomLocator.getService() === this,
        ClientIPCService.serverVersion,
      );
      api.defer(() => attempt.serviceJoin?.cancel());
    }
    this.login.removeEffects();
    attempt.serviceJoin.start(roomId);
  });
  reflection.around(Login.prototype, 'selectServiceRoom', function (next, ...args) {
    const attempt = attempts.get(this);
    if (attempt && !isCurrent(attempt)) return;
    attempt?.status?.setNetwork('Select a service room...');
    return next(...args);
  });

  reflection.around(manager, 'createJoin', function (next, ...args) {
    const attempt = attempts.get(this.login);
    if (!attempt || attempt.manager !== this) return next(...args);
    if (!isCurrent(attempt)) return;
    if (attempt.scanning && !attempt.completed) {
      // Preserve native room selection and new gameplay criteria; stop only at
      // the socket-creation boundary, as QoLAF's preparedCurrentRoom does.
      attempt.scanning = false;
      attempt.roomsReady = true;
      // Haxe also waits for its embedded library after textures and room
      // discovery finish. Keep a phase visible until the loading cover starts.
      attempt.status?.setNetwork('Preparing game...');
      finish(attempt);
      return;
    }
    return next(...args);
  });
  reflection.around(manager, 'joinCurrentSolarSystem', function (next, ...args) {
    const attempt = attempts.get(this.login);
    if (attempt?.manager === this && !isCurrent(attempt)) return;
    if (attempt?.manager === this && attempt.completed && attempt.roomsReady) {
      attempt.roomsReady = false;
      return this.createJoin();
    }
    return next(...args);
  });
}
