import type { API, Cleanup } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  JoinRoomManager,
  JoinRoomLocator,
  GameScene,
  StartSetup,
  PlayerIOError,
  type Connection,
  type Message,
} from '../game/Bindings';
import { writeConnectionStatus } from '../network/ConnectionNotices';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { isValidServiceHandshake } from './ServiceHandshake';
import { isRetryableConnectionError } from '../login/ConnectionRetryPolicy';
import { transientJoinRetryMessage } from '../login/JoinRetryMessage';
import { servicePoolFor } from './ServicePools';
import type { ServiceConnectionLease } from './ServiceConnectionLease';
import { servicePolicyFor, setServicePolicy, type ServicePolicy } from './ServicePolicy';
import { installServiceErrors } from './ServiceErrors';

interface Attempt {
  source?: GameScene;
  committed: boolean;
  cancel: Cleanup;
}

interface RecoveryOwner {
  current: () => boolean;
  policy?: () => ServicePolicy;
  retryStaleAccount?: (reason: string, delay: number) => void;
  cancel?: Cleanup;
}
const recoveryOwners = new WeakMap<JoinRoomManager, RecoveryOwner>();
const rollbackForbidden = new WeakSet<JoinRoomManager>();

export function serviceRollbackAllowed(manager: JoinRoomManager): boolean {
  return !rollbackForbidden.has(manager);
}

/** A recovery descriptor can outlive the disconnected Game scene. */
export function ownServiceReconnect(
  manager: JoinRoomManager,
  current: () => boolean,
  policy?: () => ServicePolicy,
  retryStaleAccount?: (reason: string, delay: number) => void,
): Cleanup {
  recoveryOwners.get(manager)?.cancel?.();
  const owner: RecoveryOwner = { current, policy, retryStaleAccount };
  recoveryOwners.set(manager, owner);
  return () => {
    owner.cancel?.();
    if (recoveryOwners.get(manager) === owner) recoveryOwners.delete(manager);
  };
}

/** Source handshake ownership/deadline for Service recovery. */
export function installServiceReconnect(api: API): void {
  const reflection = new GameReflection(api);
  const attempts = new Map<JoinRoomManager, Attempt>();
  const staleBudgets = new WeakMap<object, { id: string; count: number }>();
  let disposed = false;
  reflection.around(
    JoinRoomManager.prototype,
    'reconnectServiceRoom',
    function (_next, id, success, failure) {
      rollbackForbidden.delete(this);
      if (id === ClientIPCService.roomId) {
        rollbackForbidden.add(this);
        failure(ClientIPCService.reservedMessage, false);
        return;
      }
      const owner = recoveryOwners.get(this);
      const room = this.roomStateMachine.currentRoom;
      const source = reflection.is(room, 'core.scene.Game') ? room : undefined;
      if (owner ? !owner.current() : !source || source.get_isLeaving() || source.noAutoReconnect)
        return;
      const budgetOwner = owner ?? source;
      if (!budgetOwner) return;
      const previous = this.serviceConnection;
      const policy = owner?.policy?.() ?? servicePolicyFor(this);
      if (previous?.get_connected()) {
        if (previous.get_roomId() === id) {
          setServicePolicy(this, policy);
          success(previous);
        } else failure('The previous Service socket is still connected.', false);
        return;
      }
      attempts.get(this)?.cancel();
      let candidate: Connection | undefined;
      let poolLease: ServiceConnectionLease | undefined;
      let detach: Cleanup | undefined;
      let detachLive: Cleanup | undefined;
      let settled = false;
      let generation = 0;
      const budget = staleBudgets.get(budgetOwner);
      let staleRetries =
        budget && (budget.id === id || owner?.retryStaleAccount) ? budget.count : 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const attempt: Attempt = {
        source: owner ? undefined : source,
        committed: false,
        cancel: () => {
          settled = true;
          clearTimeout(timer);
          poolLease?.dispose();
          poolLease = undefined;
          detach?.();
          detachLive?.();
          if (!attempt.committed) candidate?.disconnect();
          if (attempts.get(this) === attempt) attempts.delete(this);
        },
      };
      attempts.set(this, attempt);
      if (owner)
        owner.cancel = () => {
          if (!attempt.committed) attempt.cancel();
        };
      const current = () =>
        !disposed &&
        !settled &&
        attempts.get(this) === attempt &&
        JoinRoomLocator.getService() === this &&
        (owner
          ? recoveryOwners.get(this) === owner && owner.current()
          : source !== undefined &&
            this.roomStateMachine.currentRoom === source &&
            !source.get_isLeaving() &&
            !source.noAutoReconnect &&
            source.get_connected()) &&
        this.serviceConnection === previous;
      const fail = (reason = 'The room connection timed out.') => {
        if (settled) return;
        const notify = current();
        attempt.cancel();
        if (notify) failure(reason, true);
      };
      const reject = (reason: string, allowRollback = true) => {
        if (settled) return;
        const notify = current();
        attempt.cancel();
        staleBudgets.delete(budgetOwner);
        if (!allowRollback) rollbackForbidden.add(this);
        if (notify) failure(reason, false);
      };
      const retryLock = (reason: string): boolean => {
        const status = transientJoinRetryMessage(reason);
        if (!status) return false;
        if (!current()) return true;
        if (staleRetries >= 3) {
          reject(reason, false);
          return true;
        }
        staleRetries++;
        staleBudgets.set(budgetOwner, { id, count: staleRetries });
        generation++;
        clearTimeout(timer);
        detach?.();
        detach = undefined;
        const previousCandidate = candidate;
        candidate = undefined;
        previousCandidate?.disconnect();
        const text = `${status} (${staleRetries}/3)`;
        StartSetup.showProgressText(text);
        if (this.roomStateMachine.currentRoom) writeConnectionStatus(text);
        if (owner?.retryStaleAccount) {
          attempt.cancel();
          owner.retryStaleAccount(reason, 2000);
        } else timer = setTimeout(send, 2000);
        return true;
      };
      const send = () => {
        if (!current()) return;
        const serial = ++generation;
        let sdkAnswered = false;
        const active = () => current() && serial === generation;
        timer = setTimeout(() => {
          if (active()) fail();
        }, 15000);
        const accepted = (connection: Connection, verifiedJoined?: Message) => {
          if (!active()) {
            if (connection !== candidate || !attempt.committed) connection.disconnect();
            return;
          }
          if (sdkAnswered) {
            if (candidate !== connection) connection.disconnect();
            return;
          }
          sdkAnswered = true;
          candidate = connection;
          if (!connection.get_connected()) return fail();
          if (connection.get_roomId() !== id)
            return reject('The connection did not match the requested Service room.');
          let listening = true;
          const joined = (message: Message) => {
            if (!listening || settled || serial !== generation) return;
            if (!active()) {
              attempt.cancel();
              return;
            }
            if (!connection.get_connected()) return fail();
            if (!isValidServiceHandshake(message, this.client.connectUserId))
              return reject(
                'The target room did not return a valid Service initialization response for your account.',
              );
            settled = true;
            clearTimeout(timer);
            detach?.();
            detach = undefined;
            attempt.committed = true;
            attempt.source = undefined;
            staleBudgets.delete(budgetOwner);
            this.serviceConnection = connection;
            setServicePolicy(this, policy);
            detachLive = installServiceErrors(this, connection);
            this.startServicePing(connection);
            // Do not run onJoinedServiceRoom: its payload can contain an old Game
            // destination and its event belongs to startup, not reconnection.
            success(connection);
          };
          if (verifiedJoined) {
            joined(verifiedJoined);
            return;
          }
          const lost = () => {
            if (listening && active()) fail();
          };
          const rejected = (message: Message) => {
            if (!listening || !active()) return;
            if (message.type === 'error') {
              const reason = message.getString(0);
              if (!retryLock(reason)) reject(reason);
            } else reject('The Service room rejected the connection. Please sign in again.', false);
          };
          detach = () => {
            if (!listening) return;
            listening = false;
            queueMicrotask(() => {
              connection.removeMessageHandler('joined', joined);
              for (const type of ['error', 'duplicateLogin', 'kicked'])
                connection.removeMessageHandler(type, rejected);
              connection.removeDisconnectHandler(lost);
            });
          };
          connection.addMessageHandler('joined', joined);
          for (const type of ['error', 'duplicateLogin', 'kicked'])
            connection.addMessageHandler(type, rejected);
          connection.addDisconnectHandler(lost);
        };
        try {
          const pool = source && servicePoolFor(source);
          if (source && pool?.hasService(source, id)) {
            let waiting = true;
            const acquired = pool.acquire(
              source,
              id,
              (ready) => {
                waiting = false;
                if (!active()) return;
                const handoff = pool.takeReadyForPrimary(source, id);
                if (handoff) candidate = handoff.connection;
                if (!handoff || handoff.connection !== ready) {
                  reject('The shared Service connection could not be transferred.');
                  return;
                }
                const held = poolLease;
                poolLease = undefined;
                try {
                  // Transfer ownership before publication so closing the old Game
                  // cannot close this socket alongside its auxiliary chat views.
                  accepted(handoff.connection, handoff.joined);
                } finally {
                  held?.dispose();
                }
              },
              (reason, kind) => {
                waiting = false;
                if (!active()) return;
                if (kind === 'disconnect' || kind === 'timeout') fail(reason);
                else reject(reason);
              },
            );
            // Reusing a ready pool may synchronously commit/cancel during acquire.
            if (waiting && active()) poolLease = acquired;
            else acquired.dispose();
            return;
          }
          const rejected = (error: PlayerIOError) => {
            if (!active() || sdkAnswered) return;
            sdkAnswered = true;
            if (retryLock(error.message)) return;
            if (isRetryableConnectionError(error)) fail(error.message);
            else reject(error.message);
          };
          const joinData = {
            client_version: ClientIPCService.serverVersion,
            session: this.session,
          };
          if (policy.createAllowed)
            this.client.multiplayer.createJoinRoom(
              id,
              'service',
              policy.visible,
              {},
              joinData,
              accepted,
              rejected,
            );
          else this.client.multiplayer.joinRoom(id, joinData, accepted, rejected);
        } catch (error) {
          if (settled || sdkAnswered) throw error;
          if (!active()) return;
          if (error instanceof PlayerIOError && retryLock(error.message)) return;
          const reason = 'The Service room connection could not be started.';
          if (error instanceof PlayerIOError && isRetryableConnectionError(error)) fail(reason);
          else reject(reason);
        }
      };
      send();
    },
  );
  const cancelScene = (scene: GameScene) => {
    staleBudgets.delete(scene);
    for (const attempt of attempts.values()) {
      if (attempt.source === scene && !attempt.committed) attempt.cancel();
    }
  };
  reflection.before(GameScene.prototype, 'stopServiceReconnect', function () {
    cancelScene(this);
  });
  reflection.before(GameScene.prototype, 'exit', function () {
    cancelScene(this);
  });
  reflection.before(GameScene.prototype, 'dispose', function () {
    cancelScene(this);
  });
  reflection.before(JoinRoomManager.prototype, 'joinServiceRoom', function () {
    attempts.get(this)?.cancel();
  });
  api.defer(() => {
    disposed = true;
    for (const attempt of attempts.values()) attempt.cancel();
  });
}
