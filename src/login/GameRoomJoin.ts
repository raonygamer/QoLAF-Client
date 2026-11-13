import type {} from '../game/LoginLoading';
import { writeRoomTransitionNotice } from '../network/ConnectionNotices';
import { gameRoomDestinationError } from './RoomDestination';
import { hasRoomChangeGuard } from './RoomChangeGuard';
import { ownServiceErrors } from '../service/ServiceErrors';
import { cancelRoomTransition, commitRoomTransition } from './RoomTransition';
import { watchInitialWorld } from '../rendering/InitialWorld';
import {
  abandonInitialGameConnection,
  abandonInitialWorld,
  initialGameIsReady,
  initialGameIsAbandoned,
  watchInitialGameConnection,
} from '../network/InitialGameConnection';
import { isRefreshingRoom, inheritRoomRefresh } from './RoomRefresh';
import type {} from '../game/Room';
import { observeGameJoin } from './GameJoinLifecycle';
import { transientJoinRetryMessage } from './JoinRetryMessage';
import { ConnectionRetryPolicy, isRetryableConnectionError } from './ConnectionRetryPolicy';
import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  JoinRoomManager,
  JoinRoomLocator,
  Room,
  GUID,
  StartSetup,
  Login,
  SceneBase,
  type GameScene,
  type Connection,
  PlayerIOError,
} from '../game/Bindings';

interface Request {
  manager: JoinRoomManager;
  sourceRoom: Room;
  ownerRoom: Room;
  pendingGame?: GameScene;
  acceptedConnection?: Connection;
  detachService?: Cleanup;
  detachServiceErrors?: Cleanup;
  detachInitialization?: Cleanup;
  detachReveal?: Cleanup;
  destination: Room;
  service: Connection;
  retryTimer?: ReturnType<typeof setTimeout>;
  responseTimer?: ReturnType<typeof setTimeout>;
  loadingTimer?: ReturnType<typeof setTimeout>;
  finished: boolean;
  rejectTemporary?: (scene: GameScene, reason: string) => boolean;
}

const pendingCancellations = new WeakMap<JoinRoomManager, { request: Request; cancel: Cleanup }>();

/** Recovery takes over pending join work without disposing the retained scene. */
export function cancelPendingGameRoomJoin(manager: JoinRoomManager): void {
  cancelRoomTransition(manager);
  pendingCancellations.get(manager)?.cancel();
}

/** Captures destination and Service ownership across native game-room retries. */
export function installGameRoomJoin(api: API): void {
  const reflection = new GameReflection(api);
  const requests = new Map<JoinRoomManager, Request>();
  let disposed = false;
  const clearLoading = (request: Request) => {
    request.detachInitialization?.();
    request.detachInitialization = undefined;
    request.detachReveal?.();
    request.detachReveal = undefined;
    clearTimeout(request.responseTimer);
    request.responseTimer = undefined;
    clearTimeout(request.loadingTimer);
    request.loadingTimer = undefined;
  };
  const finishRequest = (request: Request) => {
    request.finished = true;
    if (requests.get(request.manager) === request) requests.delete(request.manager);
    if (pendingCancellations.get(request.manager)?.request === request) {
      pendingCancellations.delete(request.manager);
    }
    clearLoading(request);
    clearTimeout(request.retryTimer);
    request.retryTimer = undefined;
    request.detachService?.();
    request.detachService = undefined;
    request.detachServiceErrors?.();
    request.detachServiceErrors = undefined;
  };
  const cancel = (manager: JoinRoomManager) => {
    cancelRoomTransition(manager);
    const request = requests.get(manager);
    if (!request) return;
    finishRequest(request);
    requests.delete(manager);
  };
  for (const method of ['errorFromServer', 'message'] as const) {
    reflection.around(SceneBase.prototype, method, function (next, message) {
      const manager = JoinRoomLocator.getService();
      if (
        manager &&
        reflection.is(this, 'core.scene.Game') &&
        requests.get(manager)?.rejectTemporary?.(this, message.getString(0))
      )
        return;
      return next(message);
    });
  }
  reflection.before(JoinRoomManager.prototype, 'joinGame', function () {
    if (!hasRoomChangeGuard(this)) cancel(this);
  });
  reflection.before(JoinRoomManager.prototype, 'joinServiceRoom', function () {
    cancel(this);
  });
  reflection.around(JoinRoomManager.prototype, 'createJoin', function (_next, retry = 0) {
    if (disposed || requests.has(this)) return;
    const sourceRoom = this.room;
    const observer = observeGameJoin(sourceRoom);
    const reportFailure = (reason: string, retryable = false, error?: PlayerIOError) => {
      if (observer) observer.failed(reason, retryable);
      else {
        const text = reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (error) this.showErrorDialog(text + '. Contact us on Discord for support.', true, error);
        else this.showErrorDialog(text);
      }
    };
    const service = this.serviceConnection;
    if (!service?.get_connected()) {
      reportFailure('The Service room disconnected before the Game room join.', true);
      return;
    }
    const destinationError = gameRoomDestinationError(sourceRoom);
    if (destinationError) {
      reportFailure(destinationError);
      return;
    }
    // Allocate once. A failed or ambiguous attempt must not create a new room
    // merely because the SDK was called again with a null destination ID.
    if (!sourceRoom.id) sourceRoom.id = GUID.create();
    const destination = new Room();
    destination.id = sourceRoom.id;
    destination.joinOnly = sourceRoom.joinOnly === true;
    destination.roomType = sourceRoom.roomType;
    destination.data = { ...sourceRoom.data };
    destination.joinData = { ...sourceRoom.joinData };
    inheritRoomRefresh(sourceRoom, destination);
    const request: Request = {
      manager: this,
      sourceRoom,
      ownerRoom: sourceRoom,
      destination,
      service,
      finished: false,
    };
    requests.set(this, request);
    pendingCancellations.set(this, {
      request,
      cancel: () => {
        if (requests.get(this) === request) cancel(this);
      },
    });
    const current = () =>
      !disposed &&
      !request.finished &&
      requests.get(this) === request &&
      JoinRoomLocator.getService() === this &&
      this.room === request.ownerRoom &&
      (!request.pendingGame || this.roomStateMachine.currentRoom === request.pendingGame);
    const serviceCurrent = () => this.serviceConnection === service && service.get_connected();
    const failService = (
      reason = 'The Service connection was lost while connecting to the Game room.',
      retryable = true,
    ): boolean => {
      if (!current()) return false;
      finishRequest(request);
      const scene = this.roomStateMachine.currentRoom;
      // handleJoin publishes the scene before enter returns. Service can fail
      // during that initialization, before pendingGame has been assigned.
      if (
        request.acceptedConnection &&
        reflection.is(scene, 'core.scene.Game') &&
        scene.connection === request.acceptedConnection
      ) {
        // The fade may have completed just before this disconnect dispatch.
        // A fully revealed room belongs to the established Service watcher.
        if (scene.get_initialWorldIsRevealed()) return false;
        observer?.entered(scene);
        Login.fadeScreen?.showStaticCover();
        abandonInitialWorld(scene);
      }
      if (request.acceptedConnection?.get_connected()) request.acceptedConnection.disconnect();
      reportFailure(reason, retryable);
      return true;
    };
    const policy =
      observer?.policy ??
      new ConnectionRetryPolicy(Math.max(1, retry + 1), isRefreshingRoom(sourceRoom));
    request.detachServiceErrors = ownServiceErrors(this, (reason) => {
      if (!current() || this.serviceConnection !== service) return false;
      return failService(reason, false);
    });
    const showResponseTimeout = (retryStatus?: string) => {
      const status = retryStatus ?? 'Game room is not responding.';
      StartSetup.showProgressText(status);
      this.login?.showRoomConnectionRetry?.(status);
      writeRoomTransitionNotice(
        retryStatus ? 'Game room not responding; retrying...' : 'Game room not responding.',
      );
    };
    const send = () => {
      request.retryTimer = undefined;
      if (!current()) return;
      if (!serviceCurrent()) {
        failService();
        return;
      }
      const roomId = destination.id;
      if (!roomId) {
        finishRequest(request);
        reportFailure(
          'The destination room could not be identified. Please retry the room change.',
        );
        return;
      }
      const systemKey = destination.data.solarSystemKey;
      const system =
        typeof systemKey === 'string' ? this.dataManager.loadKey('SolarSystems', systemKey) : null;
      const status = `Joining ${system?.name ?? destination.data.solarSystemKey}... (${roomId})`;
      StartSetup.showProgressText(status);
      this.login?.showRoomConnectionStatus?.(status);
      const cover = Login.fadeScreen;
      if (cover) {
        cover.loadingText.set_text(status);
        cover.loadingText.set_visible(true);
      }
      let answered = false;
      let accepted: Connection | null = null;
      const joined = (connection: Connection) => {
        if (answered || !current()) {
          if (connection === accepted) return;
          connection.disconnect();
          return;
        }
        answered = true;
        clearTimeout(request.responseTimer);
        request.responseTimer = undefined;
        destination.id = connection.get_roomId();
        if (cover)
          cover.loadingText.set_text(
            `Loading ${system?.name ?? destination.data.solarSystemKey}...`,
          );
        if (!serviceCurrent()) {
          connection.disconnect();
          failService();
          return;
        }
        accepted = connection;
        request.acceptedConnection = connection;
        request.ownerRoom = destination;
        this.room = destination;
        if (destination.joinOnly) {
          // This accepted join owns the destination. The public setters reject
          // unrelated UI requests while an invitation/Service transition runs.
          this._desiredRoomId = null;
          this._desiredSystemType = String(destination.data.systemType);
        }
        try {
          this.handleJoin(connection);
          if (!current()) return;
          const scene = reflection.cast(this.roomStateMachine.currentRoom, 'core.scene.Game');
          if (scene.connection !== connection || initialGameIsAbandoned(scene)) return;
          request.pendingGame = scene;
          observer?.entered(scene);
          const networkReady = () => {
            clearTimeout(request.responseTimer);
            request.responseTimer = undefined;
            request.detachInitialization?.();
            request.detachInitialization = undefined;
          };
          const revealed = () => {
            if (!current() || !scene.get_initialWorldIsRevealed()) return;
            if (!serviceCurrent()) {
              failService();
              return;
            }
            finishRequest(request);
            observer?.revealed(scene);
          };
          const timedOut = (loading: boolean) => {
            if (!current() || request.pendingGame !== scene) return;
            if (scene.get_initialWorldIsRevealed()) {
              revealed();
              return;
            }
            if (!loading && initialGameIsReady(scene)) {
              networkReady();
              return;
            }
            clearLoading(request);
            Login.fadeScreen?.showStaticCover();
            if (loading) abandonInitialWorld(scene);
            else abandonInitialGameConnection(scene);
            if (!serviceCurrent()) {
              failService();
              return;
            }
            const retry = loading ? policy.nextLoadingTimeout() : policy.nextTimeout();
            if (!loading) showResponseTimeout(retry?.status);
            if (!retry) {
              finishRequest(request);
              const reason = loading
                ? 'The Game room did not finish loading.'
                : 'The Game room did not respond for 8 seconds.';
              reportFailure(reason, true);
              return;
            }
            if (loading) StartSetup.showProgressText(retry.status);
            request.retryTimer = setTimeout(() => {
              if (!current()) return;
              observer?.leaving(scene);
              commitRoomTransition(this, () => {
                request.pendingGame = undefined;
                request.acceptedConnection = undefined;
                destination.joinData = { ...destination.joinData, warpJump: false };
                send();
              });
            }, retry.delay);
          };
          const arm = () => {
            clearTimeout(request.responseTimer);
            request.responseTimer = setTimeout(() => timedOut(false), 8000);
          };
          request.detachReveal = watchInitialWorld(scene, revealed);
          request.loadingTimer = setTimeout(() => timedOut(true), 45000);
          request.detachInitialization = watchInitialGameConnection(scene, (ready) => {
            if (!current()) return;
            if (ready) networkReady();
            else arm();
          });
          if (scene.get_initialWorldIsRevealed()) revealed();
          else if (initialGameIsReady(scene)) networkReady();
          else arm();
        } catch {
          finishRequest(request);
          const partial = this.roomStateMachine.currentRoom;
          if (reflection.is(partial, 'core.scene.Game') && partial.connection === connection) {
            observer?.entered(partial);
            abandonInitialGameConnection(partial);
          }
          connection.disconnect();
          reportFailure('The Game room could not be initialized. Please refresh the client.');
        }
      };
      const failed = (error: PlayerIOError) => {
        if (answered || !current()) return;
        answered = true;
        clearTimeout(request.responseTimer);
        request.responseTimer = undefined;
        if (!serviceCurrent()) {
          failService();
          return;
        }
        const retry = policy.next(error);
        if (retry) {
          if (retry.status) StartSetup.showProgressText(retry.status);
          request.retryTimer = setTimeout(send, retry.delay);
          return;
        }
        finishRequest(request);
        reportFailure(
          error.message,
          !transientJoinRetryMessage(error.message) && isRetryableConnectionError(error),
          error,
        );
      };
      // Arm only at the send boundary, after any opaque-cover/render wait.
      request.responseTimer = setTimeout(() => {
        if (answered || !current()) return;
        answered = true;
        request.responseTimer = undefined;
        if (!serviceCurrent()) {
          failService();
          return;
        }
        const retry = policy.nextTimeout();
        showResponseTimeout(retry?.status);
        if (retry) {
          if (retry.status) StartSetup.showProgressText(retry.status);
          request.retryTimer = setTimeout(send, retry.delay);
          return;
        }
        finishRequest(request);
        reportFailure('The Game room did not respond for 8 seconds.', true);
      }, 8000);
      try {
        if (destination.joinOnly) {
          // Validated before creating the request; retries retain this exact ID.
          this.client.multiplayer.joinRoom(roomId, destination.joinData, joined, failed);
        } else
          this.client.multiplayer.createJoinRoom(
            roomId,
            destination.roomType,
            false,
            destination.data,
            destination.joinData,
            joined,
            failed,
          );
      } catch (error) {
        // A synchronous completion may itself throw. It already owns the
        // outcome; do not treat its exception as another SDK join failure.
        if (answered) throw error;
        if (error instanceof PlayerIOError) failed(error);
        else if (current()) {
          answered = true;
          finishRequest(request);
          reportFailure('The Game room connection could not be started.');
        }
      }
    };
    let watchingService = true;
    const serviceDisconnected = () => {
      if (watchingService && current() && this.serviceConnection === service) failService();
    };
    const serviceRejected = () => {
      if (watchingService && current() && this.serviceConnection === service)
        failService('The Service room rejected the connection. Please sign in again.', false);
    };
    request.detachService = () => {
      if (!watchingService) return;
      watchingService = false;
      queueMicrotask(() => {
        service.removeDisconnectHandler(serviceDisconnected);
        service.removeMessageHandler('duplicateLogin', serviceRejected);
        service.removeMessageHandler('kicked', serviceRejected);
      });
    };
    service.addDisconnectHandler(serviceDisconnected);
    service.addMessageHandler('duplicateLogin', serviceRejected);
    service.addMessageHandler('kicked', serviceRejected);
    request.rejectTemporary = (scene, reason) => {
      if (
        !current() ||
        scene !== this.roomStateMachine.currentRoom ||
        scene.connection !== request.acceptedConnection ||
        scene.noAutoReconnect ||
        scene.get_initialWorldIsRevealed() ||
        !transientJoinRetryMessage(reason)
      )
        return false;
      if (initialGameIsAbandoned(scene)) return true;
      // The socket exists, but the server rejected entry. Retry the original
      // warp request instead of treating this as a completed warp/reconnect.
      if (request.pendingGame !== scene) {
        request.pendingGame = scene;
        observer?.entered(scene);
        if (!current()) return true;
      }
      clearLoading(request);
      const retry = policy.nextStale(reason);
      Login.fadeScreen?.showStaticCover();
      abandonInitialWorld(scene);
      if (!serviceCurrent()) {
        failService();
        return true;
      }
      if (!retry) {
        finishRequest(request);
        reportFailure(reason, false);
        return true;
      }
      if (retry.status) {
        StartSetup.showProgressText(retry.status);
        this.login?.showRoomConnectionRetry?.(retry.status);
        writeRoomTransitionNotice(retry.status);
      }
      const retryAt = performance.now() + retry.delay;
      // Finish the current packet/enter stack before disposing the rejected
      // scene, but release it during backoff rather than on the next join.
      queueMicrotask(() => {
        if (!current()) return;
        observer?.leaving(scene);
        commitRoomTransition(this, () => {
          request.pendingGame = undefined;
          request.acceptedConnection = undefined;
          request.retryTimer = setTimeout(send, Math.max(0, retryAt - performance.now()));
        });
      });
      return true;
    };
    send();
  });
  api.defer(() => {
    disposed = true;
    for (const manager of requests.keys()) cancel(manager);
  });
}
