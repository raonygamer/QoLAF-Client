import type {} from '../game/Room';
import type { Room } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';

/** Validate before old-room teardown as well as before the eventual send. */
export function gameRoomDestinationError(room: Room | null | undefined): string | null {
  if (
    room?.id === ClientIPCService.roomId ||
    room?.data?.service === ClientIPCService.roomId ||
    room?.data?.primaryService === ClientIPCService.roomId
  )
    return ClientIPCService.reservedMessage;
  if (!room?.data?.solarSystemKey || !room.data.service)
    return 'The destination room could not be identified. Please retry the room change.';
  if (room.joinOnly && !room.id) return 'An invited Game room must have an exact room ID.';
  return null;
}
