import type { Cleanup } from '../api/Types';
import {
  Login,
  PlayerIOError,
  Quad,
  ServiceRoomSelector,
  Sprite,
  type JoinRoomManager,
  type RoomInfo,
} from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { isRetryableConnectionError } from '../login/ConnectionRetryPolicy';
import { writeRoomTransitionNotice } from '../network/ConnectionNotices';

/** Source public-population selection, including create-only collision handling. */
export function selectPublicService(
  manager: JoinRoomManager,
  level: number,
  supporter: boolean,
  selected: (roomId: string) => void,
  failed: (reason: string, retryable: boolean) => void,
): Cleanup {
  let active = true;
  let serial = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let closePicker: Cleanup | undefined;
  const cancel = () => {
    active = false;
    serial++;
    clearTimeout(deadline);
    closePicker?.();
    closePicker = undefined;
  };
  const fail = (reason: string, retryable: boolean) => {
    if (!active) return;
    cancel();
    failed(reason, retryable);
  };
  const armDeadline = () => {
    clearTimeout(deadline);
    deadline = setTimeout(() => fail('The room connection timed out.', true), 15000);
  };
  const commit = (id: string) => {
    if (!active) return;
    if (id === ClientIPCService.roomId) {
      fail(ClientIPCService.reservedMessage, false);
      return;
    }
    cancel();
    selected(id);
  };
  const nextIndex = (used: Set<string>) => {
    const prefix = `Service-${ClientIPCService.serverVersion}_`;
    for (let index = 0; index < 1000; index++) if (!used.has(prefix + index)) return prefix + index;
    return prefix + '10000';
  };
  const create = (id: string, used: Set<string>, collisions = 0) => {
    if (!active) return;
    if (collisions >= 16 || id === ClientIPCService.roomId) {
      fail('No public Service room could be created.', true);
      return;
    }
    const generation = ++serial;
    let answered = false;
    const takeAnswer = () => {
      if (!active || generation !== serial || answered) return false;
      answered = true;
      return true;
    };
    try {
      // createJoinRoom could silently join an existing hidden room. The browser
      // SDK exposes createRoom even though Haxe's Multiplayer wrapper does not.
      manager.client.multiplayer.raw.createRoom(
        id,
        'service',
        true,
        {},
        (createdId) => {
          if (!takeAnswer()) return;
          if (createdId !== id) {
            fail('The created Service room did not match the request.', false);
            return;
          }
          commit(id);
        },
        (sdkError) => {
          if (!takeAnswer()) return;
          const error = PlayerIOError.wrap(sdkError);
          if (error.code === 'RoomAlreadyExists' || error.code === 15) {
            used.add(id);
            create(nextIndex(used), used, collisions + 1);
          } else fail(error.message, isRetryableConnectionError(error));
        },
      );
    } catch (error) {
      if (answered) throw error;
      if (active && generation === serial)
        fail(
          'The public Service room could not be created.',
          error instanceof PlayerIOError && isRetryableConnectionError(error),
        );
    }
  };
  const choose = (id: string, listed: RoomInfo[]) => {
    if (!active) return;
    closePicker?.();
    closePicker = undefined;
    armDeadline();
    if (listed.some((room) => room.id === id)) commit(id);
    else create(id, new Set(listed.map((room) => room.id)));
  };
  const showPicker = (choices: RoomInfo[], listed: RoomInfo[]) => {
    clearTimeout(deadline);
    deadline = undefined; // Human selection is not a timed network request.
    ServiceRoomSelector.playerLevel = level;
    ServiceRoomSelector.isSupporter = supporter;
    const container = new Sprite();
    const backdrop = new Quad(1, 1, 0);
    backdrop.set_alpha(0.9);
    container.addChild(backdrop);
    let choiceMade = false;
    const selector = new ServiceRoomSelector(choices, (id) => {
      if (choiceMade || !active) return;
      choiceMade = true;
      choose(id, listed);
    });
    if (!active || choiceMade) {
      selector.dispose();
      container.dispose();
      return;
    }
    container.addChild(selector);
    const layout = () => {
      const width = manager.stage.get_stageWidth(),
        height = manager.stage.get_stageHeight();
      backdrop.set_width(width);
      backdrop.set_height(height);
      selector.set_scaleX(1);
      selector.set_scaleY(1);
      const scale = Math.max(
        0.1,
        Math.min(1, (width - 40) / selector.get_width(), (height - 100) / selector.get_height()),
      );
      selector.set_scaleX(scale);
      selector.set_scaleY(scale);
      selector.set_x((width - selector.get_width()) / 2);
      selector.set_y(Math.max(70, (height - selector.get_height()) / 2));
    };
    closePicker = () => {
      manager.stage.removeEventListener('resize', layout);
      container.removeFromParent(true);
    };
    manager.stage.addChild(container);
    manager.stage.addEventListener('resize', layout);
    layout();
    Login.fadeScreen?.fadeOut();
    writeRoomTransitionNotice('Select a service room...');
  };
  armDeadline();
  let listed = false;
  try {
    manager.client.multiplayer.listRooms(
      'service',
      null,
      1000,
      0,
      (rooms) => {
        if (!active || listed) return;
        listed = true;
        const available = rooms.filter(
          (room) =>
            room.id !== ClientIPCService.roomId &&
            Number.parseInt(room.id.slice(8, 12), 10) >= ClientIPCService.serverVersion,
        );
        if (!available.length) choose(`Service-${ClientIPCService.serverVersion}_0`, rooms);
        else if (available.length === 1 && available[0]!.onlineUsers < 40)
          choose(available[0]!.id, rooms);
        else showPicker(available, rooms);
      },
      (error) => {
        if (!active || listed) return;
        listed = true;
        fail(
          'Public Service rooms could not be listed: ' + error.message,
          isRetryableConnectionError(error),
        );
      },
    );
  } catch (error) {
    if (listed) throw error;
    fail(
      'Public Service discovery could not be started.',
      error instanceof PlayerIOError && isRetryableConnectionError(error),
    );
  }
  return cancel;
}
