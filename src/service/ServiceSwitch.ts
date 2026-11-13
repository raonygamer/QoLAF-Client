import type {} from '../game/InitialWorld';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { GameScene, JoinRoomLocator, MessageLog, Room, type Connection } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { isWarpJoinPending } from '../login/WarpTransition';
import { gameRecoveryActive } from './GameRecovery';
import { writeConnectionStatus } from '../network/ConnectionNotices';
import type { ServicePolicy } from './ServicePolicy';

export interface ServiceSwitchRequest {
  serviceId: string;
  policy: ServicePolicy;
  reconnect: boolean;
  clanId: string;
}

interface Pending {
  scene: GameScene;
  service: Connection | null;
  game: Connection | null;
  room: Room;
  index: number;
  reconnect: boolean;
  requestedAt: number;
}

let command: ((scene: GameScene, argument: string, joinOnly: boolean) => void) | undefined;

export function requestServiceSwitch(scene: GameScene, argument: string, joinOnly: boolean): void {
  command?.(scene, argument, joinOnly);
}

/** Private command grammar and one-use confirmation, copied from the source client. */
export function installServiceSwitch(
  api: API,
  begin: (scene: GameScene, request: ServiceSwitchRequest) => void,
): void {
  const reflection = new GameReflection(api);
  let pending: Pending | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };
  const change = (
    scene: GameScene,
    index: number,
    visible: boolean,
    reconnect: boolean,
    createAllowed: boolean,
    confirmed = false,
  ) => {
    clear();
    const manager = JoinRoomLocator.getService();
    const player = scene.get_me();
    if (index === ClientIPCService.serviceIndex) {
      writeConnectionStatus(ClientIPCService.reservedMessage);
      return;
    }
    if (
      !manager ||
      manager.roomStateMachine.currentRoom !== scene ||
      scene.noAutoReconnect ||
      scene.idleDisconnected ||
      scene.get_isLeaving() ||
      !player ||
      !scene.solarSystem ||
      !scene.room?.data.systemType ||
      !scene.get_initialWorldIsRevealed() ||
      !scene.get_connected() ||
      !scene.serviceConnection?.get_connected() ||
      manager.serviceConnection !== scene.serviceConnection
    ) {
      writeConnectionStatus('Service switch unavailable until both rooms are connected.');
      return;
    }
    if (gameRecoveryActive(manager) || isWarpJoinPending(scene) || player.get_isWarpJumping()) {
      writeConnectionStatus('Wait for the current room transition before switching Service rooms.');
      return;
    }
    const instanceType = String(scene.room.data.systemType);
    if (reconnect && !['friendly', 'hostile', 'clan'].includes(instanceType)) {
      writeConnectionStatus(
        createAllowed
          ? `Game reconnect supports PvE, PvP and clan instances. Use /switchservice ${index} ${visible} false to keep this Game room.`
          : '/joinservice supports PvE, PvP and clan instances. Leave the match before joining another Service.',
      );
      return;
    }
    if (reconnect && instanceType === 'clan' && !player.clanId) {
      writeConnectionStatus('You must be in a clan to reconnect to a clan instance.');
      return;
    }
    const serviceId = `Service-${ClientIPCService.serverVersion}_${index}`;
    if (createAllowed && visible && !confirmed) {
      pending = {
        scene,
        service: manager.serviceConnection,
        game: manager.connection,
        room: scene.room,
        index,
        reconnect,
        requestedAt: performance.now(),
      };
      timer = setTimeout(clear, 30000);
      writeConnectionStatus(
        'This action is potentially dangerous, it might create a visible service room for all the players. Do you really want to do it?',
      );
      writeConnectionStatus(
        `Use /switchservice confirm within 30 seconds to switch to ${serviceId} (visible=true, reconnect Game=${reconnect}), or /switchservice cancel.`,
      );
      return;
    }
    begin(scene, {
      serviceId,
      policy: { visible, createAllowed },
      reconnect,
      clanId: player.clanId ?? '',
    });
  };
  const handle = (scene: GameScene, argument: string, joinOnly: boolean) => {
    const action = argument.trim().toLowerCase();
    if (!joinOnly && (action === 'confirm' || action === 'cancel')) {
      const saved = pending;
      clear();
      if (action === 'cancel') {
        writeConnectionStatus(
          saved
            ? 'Visible Service switch cancelled.'
            : 'No visible Service switch is awaiting confirmation.',
        );
        return;
      }
      if (!saved || performance.now() - saved.requestedAt >= 30000) {
        writeConnectionStatus(
          'No pending visible Service switch, or confirmation expired. Run /switchservice again.',
        );
        return;
      }
      const manager = JoinRoomLocator.getService();
      if (
        !manager ||
        saved.scene !== scene ||
        saved.service !== manager.serviceConnection ||
        saved.game !== manager.connection ||
        saved.room !== scene.room
      ) {
        writeConnectionStatus(
          'The room connection changed; visible Service switch cancelled. Run /switchservice again.',
        );
        return;
      }
      change(scene, saved.index, true, saved.reconnect, true, true);
      return;
    }
    const parsed = (
      joinOnly ? /^\s*([0-9]+)\s*$/ : /^\s*([0-9]+)(?:\s+(true|false))?(?:\s+(true|false))?\s*$/i
    ).exec(argument);
    const index = parsed ? Number(parsed[1]) : NaN;
    if (!parsed || !Number.isFinite(index) || index > 2147483647) {
      MessageLog.write(
        joinOnly
          ? '[error] Usage: /joinservice <int>. Index must be 0-2147483647; no optional flags.'
          : '[error] Usage: /switchservice <int> [visible=false] [reconnect=true]. Index must be 0-2147483647; optional flags must be true or false. Use /switchservice confirm or /switchservice cancel for a pending visible switch.',
        'error',
      );
      return;
    }
    change(
      scene,
      index,
      !joinOnly && parsed[2]?.toLowerCase() === 'true',
      joinOnly || !parsed[3] || parsed[3].toLowerCase() === 'true',
      !joinOnly,
    );
  };
  command = handle;
  reflection.before(GameScene.prototype, 'exit', clear);
  reflection.before(GameScene.prototype, 'handleGameDisconnect', clear);
  reflection.before(GameScene.prototype, 'handleServiceDisconnect', clear);
  reflection.before(GameScene.prototype, 'warpJump', clear);
  reflection.before(GameScene.prototype, 'reload', clear);
  api.defer(() => {
    clear();
    if (command === handle) command = undefined;
  });
}
