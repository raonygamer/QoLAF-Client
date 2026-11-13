import { initialGameIsAbandoned } from '../network/InitialGameConnection';
import type {} from '../game/GameRecovery';
import type {} from '../game/InitialWorld';
import type {} from '../game/LoadingCover';
import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  GameScene,
  JoinRoomManager,
  JoinRoomLocator,
  Login,
  PopupMessage,
  StartSetup,
  Room,
  type Connection,
} from '../game/Bindings';
import { writeConnectionStatus, writeRoomTransitionNotice } from '../network/ConnectionNotices';
import { ConnectionRetryPolicy } from '../login/ConnectionRetryPolicy';
import { ownServiceReconnect, serviceRollbackAllowed } from './ServiceReconnect';
import { snapshotRecoveryRoom } from '../login/RecoveryRoom';
import { gameRoomDestinationError } from '../login/RoomDestination';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { watchGameJoin } from '../login/GameJoinLifecycle';
import { cancelPendingGameRoomJoin } from '../login/GameRoomJoin';
import { reconnectServiceViews } from './ServiceViews';
import { servicePolicyFor, setServicePolicy, type ServicePolicy } from './ServicePolicy';
import { installServiceSwitch, type ServiceSwitchRequest } from './ServiceSwitch';
import { servicePoolFor } from './ServicePools';
import { discoverServiceGame } from './ServiceGameDiscovery';
import { selectPublicService } from './PublicServiceSelection';
import { ownServiceErrors } from './ServiceErrors';
import { installRoomInviteJoin } from './RoomInviteJoin';
import { ownRoomChangeGuard, hasRoomChangeGuard, rejectRoomChange } from '../login/RoomChangeGuard';
import { cancelPendingWarpJoin } from '../login/WarpTransition';
import { installOperatorRecovery, operatorDisconnectActive } from '../network/OperatorDisconnect';

interface ServiceTransition extends ServiceSwitchRequest {
  previous?: { id: string; policy: ServicePolicy };
  rollback: boolean;
  discover: boolean;
  excludedGameId?: string;
}

interface Recovery {
  room: Room;
  serviceId: string;
  policy: ConnectionRetryPolicy;
  releaseService?: Cleanup;
  releaseRoomGuard?: Cleanup;
  releaseErrors?: Cleanup;
  scene: GameScene | null;
  closing: boolean;
  timer?: ReturnType<typeof setTimeout>;
  detach?: Cleanup;
  detachService?: Cleanup;
  closePopup?: Cleanup;
  cancelCover?: Cleanup;
  cancelDiscovery?: Cleanup;
  transition?: ServiceTransition;
  publicSelection?: {
    level: number;
    supporter: boolean;
    needsSelection: boolean;
    committed: boolean;
  };
}

const activeRecoveries = new WeakSet<JoinRoomManager>();
export function gameRecoveryActive(manager: JoinRoomManager | null): boolean {
  return manager !== null && activeRecoveries.has(manager);
}

const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Restore Service first, then rebuild the captured Game through its owned join. */
export function installGameRecovery(api: API): void {
  const reflection = new GameReflection(api);
  const recoveries = new Map<JoinRoomManager, Recovery>();
  const prototype = GameScene.prototype;
  const previousGetter = Object.getOwnPropertyDescriptor(
    prototype,
    'get_isRecoveringGameConnection',
  );
  const previousProperty = Object.getOwnPropertyDescriptor(prototype, 'isRecoveringGameConnection');
  const isRecovering = function (this: GameScene): boolean {
    const manager = JoinRoomLocator.getService();
    return manager !== null && recoveries.get(manager)?.scene === this;
  };
  Object.defineProperties(prototype, {
    get_isRecoveringGameConnection: { configurable: true, writable: true, value: isRecovering },
    isRecoveringGameConnection: { configurable: true, get: isRecovering },
  });
  api.defer(() => {
    if (prototype.get_isRecoveringGameConnection === isRecovering) {
      if (previousGetter)
        Object.defineProperty(prototype, 'get_isRecoveringGameConnection', previousGetter);
      else Reflect.deleteProperty(prototype, 'get_isRecoveringGameConnection');
    }
    if (
      Object.getOwnPropertyDescriptor(prototype, 'isRecoveringGameConnection')?.get === isRecovering
    ) {
      if (previousProperty)
        Object.defineProperty(prototype, 'isRecoveringGameConnection', previousProperty);
      else Reflect.deleteProperty(prototype, 'isRecoveringGameConnection');
    }
  });
  const release = (manager: JoinRoomManager) => {
    const recovery = recoveries.get(manager);
    if (!recovery) return;
    recoveries.delete(manager);
    activeRecoveries.delete(manager);
    recovery.releaseService?.();
    recovery.releaseRoomGuard?.();
    recovery.releaseErrors?.();
    clearTimeout(recovery.timer);
    recovery.detach?.();
    recovery.detachService?.();
    recovery.closePopup?.();
    recovery.cancelCover?.();
    recovery.cancelDiscovery?.();
  };
  const current = (manager: JoinRoomManager, recovery: Recovery) =>
    recoveries.get(manager) === recovery &&
    JoinRoomLocator.getService() === manager &&
    (recovery.scene
      ? manager.roomStateMachine.currentRoom === recovery.scene &&
        !recovery.scene.get_isLeaving() &&
        !recovery.scene.noAutoReconnect
      : !manager.roomStateMachine.currentRoom);
  const closeScene = (manager: JoinRoomManager, recovery: Recovery): boolean => {
    recovery.closing = true;
    try {
      if (recovery.scene) manager.roomStateMachine.closeCurrentRoom();
      recovery.scene = null;
      return !manager.roomStateMachine.currentRoom;
    } catch {
      return false;
    } finally {
      recovery.closing = false;
    }
  };
  const notice = writeRoomTransitionNotice;
  const failed = (
    manager: JoinRoomManager,
    recovery: Recovery,
    reason: string,
    retryable: boolean,
    allowRollback = true,
    retryDelay?: number,
  ) => {
    if (!current(manager, recovery)) return;
    recovery.detach?.();
    recovery.detach = undefined;
    recovery.detachService?.();
    recovery.detachService = undefined;
    recovery.cancelCover?.();
    recovery.cancelCover = undefined;
    recovery.cancelDiscovery?.();
    recovery.cancelDiscovery = undefined;
    clearTimeout(recovery.timer);
    recovery.timer = undefined;
    if (recovery.publicSelection && !recovery.publicSelection.committed)
      recovery.publicSelection.needsSelection = true;
    if (retryable && retryDelay !== undefined) {
      start(manager, recovery, retryDelay, false);
      return;
    }
    if (retryable) {
      const retry = recovery.policy.nextLoadingTimeout();
      if (retry) {
        notice(retry.status);
        start(manager, recovery, retry.delay, false);
        return;
      }
    }
    {
      const transition = recovery.transition;
      const previous = transition?.previous;
      if (allowRollback && transition && previous && recovery.scene) {
        transition.previous = undefined;
        transition.rollback = true;
        transition.discover = false;
        transition.reconnect = false;
        transition.policy = previous.policy;
        recovery.serviceId = previous.id;
        recovery.policy = new ConnectionRetryPolicy();
        notice('Service switch failed; restoring previous Service...');
        const connection = manager.serviceConnection;
        if (connection?.get_connected() && connection.get_roomId() !== previous.id) {
          try {
            if (servicePoolFor(recovery.scene)?.releasePrimary(recovery.scene, connection))
              manager.serviceConnection = null;
            else connection.disconnect();
          } catch {
            if (connection.get_connected()) {
              failed(
                manager,
                recovery,
                'Could not close the Service socket for rollback.',
                false,
                false,
              );
              return;
            }
          }
        }
        start(manager, recovery);
        return;
      }
    }
    Login.fadeScreen?.fadeOut();
    if (!retryable) {
      if (recovery.scene) recovery.scene.noAutoReconnect = true;
      release(manager);
      manager.showErrorDialog(`Reconnection stopped: ${escapeText(reason)}`);
      return;
    }
    notice('Reconnect failed. Choose Retry.');
    const popup = new PopupMessage('Retry');
    popup.set_text(
      'The room could not be reconnected.<br/>' +
        escapeText(reason) +
        '<br/><br/>Check your connection, then choose Retry.',
    );
    const close = () => {
      popup.removeEventListener('close', retry);
      popup.removeFromParent(true);
      recovery.closePopup = undefined;
    };
    const retry = () => {
      if (!current(manager, recovery)) return;
      close();
      recovery.policy = new ConnectionRetryPolicy();
      start(manager, recovery);
    };
    recovery.closePopup = close;
    popup.addEventListener('close', retry);
    manager.stage.addChild(popup);
  };
  function watchService(
    manager: JoinRoomManager,
    recovery: Recovery,
    connection: Connection,
  ): void {
    recovery.detachService?.();
    let watching = true;
    const disconnected = () => {
      if (watching)
        failed(manager, recovery, 'The Service room disconnected during recovery.', true);
    };
    const rejected = () => {
      if (watching)
        failed(
          manager,
          recovery,
          'The Service room rejected the connection. Please sign in again.',
          false,
          false,
        );
    };
    recovery.detachService = () => {
      if (!watching) return;
      watching = false;
      queueMicrotask(() => {
        connection.removeDisconnectHandler(disconnected);
        connection.removeMessageHandler('duplicateLogin', rejected);
        connection.removeMessageHandler('kicked', rejected);
      });
    };
    connection.addDisconnectHandler(disconnected);
    connection.addMessageHandler('duplicateLogin', rejected);
    connection.addMessageHandler('kicked', rejected);
  }
  function start(
    manager: JoinRoomManager,
    recovery: Recovery,
    delay = 1000,
    closeNow = true,
  ): void {
    if (!current(manager, recovery)) return;
    if (!recovery.scene?.get_connected()) Login.fadeScreen?.showStaticCover();
    const close = () => {
      if (closeScene(manager, recovery)) {
        Login.fadeScreen?.resumeLoadingAfterTeardown();
        return true;
      }
      release(manager);
      manager.showErrorDialog(
        'The disconnected Game room could not be cleaned up. Please refresh the client.',
      );
      return false;
    };
    const retainSwitchScene = !!recovery.transition && !!recovery.scene;
    if (!retainSwitchScene && closeNow && !recovery.scene?.get_connected() && !close()) return;
    recovery.timer = setTimeout(() => {
      recovery.timer = undefined;
      if (!current(manager, recovery)) return;
      if (!retainSwitchScene && !closeNow && !recovery.scene?.get_connected() && !close()) return;
      if (recovery.publicSelection?.needsSelection) selectPublic(manager, recovery);
      else connectService(manager, recovery);
    }, delay);
  }
  function selectPublic(manager: JoinRoomManager, recovery: Recovery): void {
    const selection = recovery.publicSelection;
    if (!selection || !current(manager, recovery)) return;
    let waiting = true;
    const cancel = selectPublicService(
      manager,
      selection.level,
      selection.supporter,
      (id) => {
        waiting = false;
        recovery.cancelDiscovery = undefined;
        if (!current(manager, recovery)) return;
        selection.needsSelection = false;
        recovery.serviceId = id;
        notice(`Joining ${id}...`);
        const previous = manager.serviceConnection;
        if (previous?.get_connected() && previous.get_roomId() !== id) {
          try {
            previous.disconnect();
          } catch {
            if (previous.get_connected()) {
              failed(
                manager,
                recovery,
                'The previous Service socket could not be closed.',
                true,
                false,
              );
              return;
            }
          }
        }
        if (current(manager, recovery)) connectService(manager, recovery);
      },
      (reason, retryable) => {
        waiting = false;
        recovery.cancelDiscovery = undefined;
        failed(manager, recovery, reason, retryable, false);
      },
    );
    if (waiting && current(manager, recovery)) recovery.cancelDiscovery = cancel;
    else cancel();
  }
  function connectService(manager: JoinRoomManager, recovery: Recovery): void {
    const restoringService = !manager.serviceConnection?.get_connected();
    manager.reconnectServiceRoom(
      recovery.serviceId,
      (connection) => {
        if (!current(manager, recovery)) return;
        if (!connection.get_connected()) {
          failed(manager, recovery, 'The Service room disconnected during initialization.', true);
          return;
        }
        if (connection.get_roomId() !== recovery.serviceId) {
          failed(
            manager,
            recovery,
            'The connection did not match the requested Service room.',
            false,
          );
          return;
        }
        if (recovery.publicSelection) recovery.publicSelection.committed = true;
        watchService(manager, recovery, connection);
        const scene = recovery.scene;
        if (scene && scene.serviceConnection !== connection) {
          // The original commits Service to the retained Game before discovery
          // or teardown, so its handlers and read-only views use the new socket.
          try {
            scene.replaceServiceConnection(connection);
          } catch {
            failed(
              manager,
              recovery,
              'The active room could not accept the Service connection.',
              false,
            );
            return;
          }
          if (!current(manager, recovery)) return;
          if (scene.serviceConnection !== connection) {
            failed(
              manager,
              recovery,
              'The active room could not accept the Service connection.',
              false,
            );
            return;
          }
          scene.serviceReconnectAttempt = 0;
          if (recovery.transition) recovery.transition.previous = undefined;
          const player = scene.get_me();
          if (scene.solarSystem && player?.get_name() != null) scene.updateServiceRoom();
          reconnectServiceViews(scene);
        }
        if (!current(manager, recovery) || !connection.get_connected()) return;
        {
          const transition = recovery.transition;
          if (transition) {
            // Once the target handshake commits, later Game failures must
            // stay in that sector instead of silently restoring the old one.
            transition.previous = undefined;
            if (transition.discover) {
              let waiting = true;
              const cancel = discoverServiceGame(
                manager,
                recovery.room,
                recovery.serviceId,
                transition.clanId,
                (room) => {
                  waiting = false;
                  recovery.cancelDiscovery = undefined;
                  if (!current(manager, recovery)) return;
                  recovery.room = room;
                  transition.discover = false;
                  // The transition owns these fields; external setters are
                  // blocked until the selected Game has finished revealing.
                  manager._desiredRoomId = null;
                  manager._desiredSystemType = String(room.data.systemType);
                  notice('Rejoining Game room...');
                  prepareGame(manager, recovery);
                },
                (reason, retryable) => {
                  waiting = false;
                  recovery.cancelDiscovery = undefined;
                  failed(manager, recovery, reason, retryable);
                },
                transition.excludedGameId,
              );
              if (waiting && current(manager, recovery)) recovery.cancelDiscovery = cancel;
              else cancel();
              return;
            }
            if (!transition.reconnect && recovery.scene?.get_connected()) {
              release(manager);
              notice(transition.rollback ? 'Previous Service restored.' : 'Service switched.');
              return;
            }
          }
        }
        if (restoringService && !recovery.scene)
          writeConnectionStatus('Reconnected to Service room.');
        prepareGame(manager, recovery);
      },
      (reason = 'The room connection timed out.', retryable = true) => {
        failed(manager, recovery, reason, retryable, serviceRollbackAllowed(manager));
      },
    );
  }
  function prepareGame(manager: JoinRoomManager, recovery: Recovery): void {
    if (!recovery.scene) return joinGame(manager, recovery);
    recovery.scene.blockHotkeys = true;
    recovery.scene.enableTrackFPS = false;
    recovery.scene.removeEventListener(
      'enterFrame',
      reflection.bound(recovery.scene, recovery.scene.update),
    );
    const proceed = () => {
      recovery.cancelCover = undefined;
      if (!current(manager, recovery)) return;
      if (
        !manager.serviceConnection?.get_connected() ||
        manager.serviceConnection.get_roomId() !== recovery.serviceId
      ) {
        failed(
          manager,
          recovery,
          'The target Service connection was lost before recovery could continue.',
          true,
        );
        return;
      }
      if (!closeScene(manager, recovery)) {
        release(manager);
        manager.showErrorDialog(
          'The previous Game room could not be closed. Please refresh the client.',
        );
        return;
      }
      Login.fadeScreen?.resumeLoadingAfterTeardown();
      if (
        typeof __QOLAF_PRIVATE__ !== 'undefined' &&
        __QOLAF_PRIVATE__ &&
        recovery.transition &&
        recovery.room.data.systemType === 'clan'
      ) {
        // The original waits only after actually releasing a retained Game,
        // before starting the new clan-instance request/response deadline.
        StartSetup.showProgressText('Waiting for the previous clan instance to disconnect...');
        writeConnectionStatus(
          'Previous Game disconnected. Waiting 2 seconds before joining the clan instance...',
        );
        recovery.timer = setTimeout(() => {
          recovery.timer = undefined;
          if (!current(manager, recovery)) return;
          if (
            !manager.serviceConnection?.get_connected() ||
            manager.serviceConnection.get_roomId() !== recovery.serviceId
          ) {
            failed(
              manager,
              recovery,
              'The Service room disconnected before the Game room join.',
              true,
            );
            return;
          }
          joinGame(manager, recovery);
        }, 2000);
        return;
      }
      joinGame(manager, recovery);
    };
    const cover = Login.fadeScreen;
    if (!cover) return proceed();
    const token = cover.showStaticCoverUntilPresented(proceed);
    recovery.cancelCover = () => cover.cancelStaticCoverWait(token);
  }
  function guardRoomChanges(manager: JoinRoomManager, recovery: Recovery): void {
    let waitNotified = false;
    recovery.releaseRoomGuard = ownRoomChangeGuard(manager, () => {
      if (recovery.scene && !recovery.scene.get_isLeaving()) cancelPendingWarpJoin(recovery.scene);
      if (!recovery.detach) Login.fadeScreen?.fadeOut();
      if (!waitNotified) {
        waitNotified = true;
        writeConnectionStatus('Wait for the Service switch to finish before changing Game rooms.');
      }
    });
  }
  function beginServiceTransition(
    scene: GameScene,
    request: ServiceSwitchRequest,
    invitedRoom?: Room,
  ): boolean {
    const manager = JoinRoomLocator.getService();
    if (!manager || recoveries.has(manager)) return false;
    const room = invitedRoom ?? snapshotRecoveryRoom(scene, manager);
    const previous = manager.serviceConnection;
    if (!room || !previous) {
      writeConnectionStatus(
        'The current Game room could not be identified; Service switch cancelled.',
      );
      return false;
    }
    const sameService = previous.get_roomId() === request.serviceId;
    if (sameService && !invitedRoom) {
      setServicePolicy(manager, request.policy);
      notice(`Already on ${request.serviceId}; settings updated.`);
      if (!request.reconnect) return true;
    }
    const recovery: Recovery = {
      room,
      serviceId: request.serviceId,
      policy: new ConnectionRetryPolicy(),
      scene,
      closing: false,
      transition: {
        ...request,
        rollback: false,
        discover: !invitedRoom && request.reconnect,
        previous:
          invitedRoom && sameService
            ? undefined
            : { id: previous.get_roomId(), policy: servicePolicyFor(manager) },
      },
    };
    cancelPendingGameRoomJoin(manager);
    recoveries.set(manager, recovery);
    activeRecoveries.add(manager);
    recovery.releaseErrors = ownServiceErrors(manager, (reason) => {
      if (!current(manager, recovery) || recovery.closePopup) return false;
      failed(manager, recovery, reason, false);
      return true;
    });
    scene.stopServiceReconnect();
    guardRoomChanges(manager, recovery);
    recovery.releaseService = ownServiceReconnect(
      manager,
      () => current(manager, recovery),
      () => recovery.transition!.policy,
    );
    notice(
      invitedRoom
        ? 'Joining room...'
        : `${request.policy.createAllowed ? 'Switching to ' : 'Joining '}${request.serviceId}...`,
    );
    if (!sameService) {
      try {
        if (servicePoolFor(scene)?.releasePrimary(scene, previous))
          manager.serviceConnection = null;
        else previous.disconnect();
      } catch {
        if (previous.get_connected()) {
          release(manager);
          writeConnectionStatus(
            invitedRoom
              ? 'The Service socket could not be closed; invite cancelled.'
              : 'The Service socket could not be closed; switch cancelled.',
          );
          return false;
        }
      }
    }
    start(manager, recovery, 0);
    return true;
  }
  installRoomInviteJoin(api, (scene, destination, serviceId) =>
    beginServiceTransition(
      scene,
      {
        serviceId,
        policy: { visible: false, createAllowed: false },
        reconnect: true,
        clanId: scene.get_me()?.clanId ?? '',
      },
      destination,
    ),
  );
  if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__)
    installServiceSwitch(api, (scene, request) => {
      beginServiceTransition(scene, request);
    });
  installOperatorRecovery(api, (scene) => {
    const manager = JoinRoomLocator.getService();
    const player = scene.get_me();
    if (
      !manager ||
      manager.roomStateMachine.currentRoom !== scene ||
      scene.noAutoReconnect ||
      scene.get_isLeaving() ||
      !player ||
      !scene.solarSystem ||
      !scene.room
    )
      return;
    const previous = snapshotRecoveryRoom(scene, manager);
    if (!previous || typeof previous.data.solarSystemKey !== 'string') {
      writeConnectionStatus('The current system could not be identified after the room removal.');
      return;
    }
    const system = manager.dataManager.loadKey('SolarSystems', previous.data.solarSystemKey);
    if (!system) {
      writeConnectionStatus('The current system is unavailable for reconnection.');
      return;
    }
    const mode = previous.data.systemType === 'hostile' ? 'hostile' : 'friendly';
    const room = new Room();
    room.id = null;
    room.roomType = 'game';
    room.data = {
      solarSystemKey: previous.data.solarSystemKey,
      systemType: mode,
      pvpAboveCap: player.get_level() > system.pvpLvlCap,
    };
    room.joinData = {
      client_version: ClientIPCService.serverVersion,
      session: manager.session,
      level: player.get_level(),
      warpJump: mode !== previous.data.systemType,
    };
    release(manager);
    cancelPendingGameRoomJoin(manager);
    cancelPendingWarpJoin(scene);
    const recovery: Recovery = {
      room,
      serviceId: '',
      policy: new ConnectionRetryPolicy(),
      scene,
      closing: false,
      transition: {
        serviceId: '',
        policy: { visible: true, createAllowed: false },
        reconnect: true,
        clanId: player.clanId ?? '',
        rollback: false,
        discover: true,
        excludedGameId: previous.id ?? undefined,
      },
      publicSelection: {
        level: player.get_level(),
        supporter: player.hasSupporter(),
        needsSelection: true,
        committed: false,
      },
    };
    recoveries.set(manager, recovery);
    activeRecoveries.add(manager);
    recovery.releaseErrors = ownServiceErrors(manager, (reason) => {
      if (!current(manager, recovery) || recovery.closePopup) return false;
      failed(manager, recovery, reason, false, false);
      return true;
    });
    guardRoomChanges(manager, recovery);
    scene.stopServiceReconnect();
    recovery.releaseService = ownServiceReconnect(
      manager,
      () => current(manager, recovery),
      () => recovery.transition!.policy,
      (reason, delay) => failed(manager, recovery, reason, true, false, delay),
    );
    scene.blockHotkeys = true;
    scene.enableTrackFPS = false;
    scene.removeEventListener('enterFrame', reflection.bound(scene, scene.update));
    Login.fadeScreen?.showStaticCover();
    if (!closeScene(manager, recovery)) {
      release(manager);
      manager.showErrorDialog(
        'The removed Game room could not be cleaned up. Please refresh the client.',
      );
      return;
    }
    start(manager, recovery, 0);
  });
  function joinGame(manager: JoinRoomManager, recovery: Recovery): void {
    recovery.detach = watchGameJoin(recovery.room, {
      policy: recovery.policy,
      entered: (scene) => {
        if (recoveries.get(manager) === recovery) recovery.scene = scene;
      },
      leaving: (scene) => {
        if (recoveries.get(manager) === recovery && recovery.scene === scene) recovery.scene = null;
      },
      revealed: () => {
        if (!current(manager, recovery)) return;
        release(manager);
        notice('Room connected.');
      },
      failed: (reason, retryable) => failed(manager, recovery, reason, retryable),
    });
    manager.room = recovery.room;
    // GameRoomJoin owns Service loss/rejection through initialization and reveal.
    recovery.detachService?.();
    recovery.detachService = undefined;
    try {
      manager.createJoin();
    } catch {
      failed(manager, recovery, 'The Game room connection could not be started.', false);
    }
  }
  function beginRecovery(scene: GameScene): void {
    const manager = JoinRoomLocator.getService();
    if (
      !manager ||
      scene.noAutoReconnect ||
      scene.idleDisconnected ||
      scene.get_isLeaving() ||
      scene.disconnectPopup
    )
      return;
    if (recoveries.has(manager)) return;
    if (manager.roomStateMachine.currentRoom !== scene) return;
    const room = snapshotRecoveryRoom(scene, manager);
    const serviceId = scene.serviceConnection?.get_roomId() || scene.serviceRoomId;
    const invalid =
      !room || !serviceId
        ? 'The current room could not be identified. Please refresh the client.'
        : serviceId === ClientIPCService.roomId
          ? ClientIPCService.reservedMessage
          : gameRoomDestinationError(room);
    if (!room || invalid) {
      scene.noAutoReconnect = true;
      manager.showErrorDialog(
        `Reconnection stopped: ${escapeText(invalid ?? 'The current room could not be identified. Please refresh the client.')}`,
      );
      return;
    }
    const recovery: Recovery = {
      room,
      serviceId,
      policy: new ConnectionRetryPolicy(),
      scene,
      closing: false,
    };
    cancelPendingGameRoomJoin(manager);
    recoveries.set(manager, recovery);
    activeRecoveries.add(manager);
    recovery.releaseErrors = ownServiceErrors(manager, (reason) => {
      if (!current(manager, recovery) || recovery.closePopup) return false;
      failed(manager, recovery, reason, false);
      return true;
    });
    scene.stopServiceReconnect();
    recovery.releaseService = ownServiceReconnect(manager, () => current(manager, recovery));
    scene.blockHotkeys = true;
    scene.enableTrackFPS = false;
    scene.removeEventListener('enterFrame', reflection.bound(scene, scene.update));
    if (!scene.serviceConnection?.get_connected())
      writeConnectionStatus('Service disconnected; reconnecting...');
    if (!scene.get_connected()) writeConnectionStatus('Game disconnected; reconnecting...');
    start(manager, recovery);
  }
  reflection.around(GameScene.prototype, 'handleGameDisconnect', function (next) {
    if (operatorDisconnectActive(this) || initialGameIsAbandoned(this)) return;
    const manager = JoinRoomLocator.getService();
    const recovery = manager && recoveries.get(manager);
    if (recovery?.scene === this) {
      this.blockHotkeys = true;
      this.enableTrackFPS = false;
      this.removeEventListener('enterFrame', reflection.bound(this, this.update));
      writeConnectionStatus('Game disconnected; reconnecting...');
      return;
    }
    // Initial joins retain their own initialization deadlines.
    if (!this.get_initialWorldIsRevealed() && !gameRecoveryActive(JoinRoomLocator.getService()))
      return next();
    beginRecovery(this);
  });
  reflection.around(GameScene.prototype, 'reload', function (next) {
    if (!this.serviceConnection?.get_connected()) {
      beginRecovery(this);
      return;
    }
    next();
  });
  for (const method of ['joinGame', 'joinServiceRoom'] as const) {
    reflection.before(JoinRoomManager.prototype, method, function () {
      if (method === 'joinGame' && hasRoomChangeGuard(this)) return;
      release(this);
    });
  }
  reflection.around(JoinRoomManager.prototype, 'joinCurrentSolarSystem', function (next) {
    if (!rejectRoomChange(this)) next();
  });
  reflection.around(JoinRoomManager.prototype, 'set_desiredRoomId', function (next, value) {
    return hasRoomChangeGuard(this) ? this.get_desiredRoomId() : next(value);
  });
  reflection.around(JoinRoomManager.prototype, 'set_desiredSystemType', function (next, value) {
    return hasRoomChangeGuard(this) ? this.get_desiredSystemType() : next(value);
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    for (const [manager, recovery] of recoveries) {
      if (!recovery.closing && recovery.scene === this) release(manager);
    }
  });
  api.defer(() => {
    for (const manager of recoveries.keys()) release(manager);
  });
}
