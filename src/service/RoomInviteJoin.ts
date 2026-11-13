import type {} from '../game/Room';
import type {} from '../game/InitialWorld';
import type { API } from '../api/Types';
import { JoinRoomLocator, Room, type GameScene } from '../game/Bindings';
import { isRoomOperator } from '../chat/RoomControlIdentity';
import { validInvitedService, type RoomInviteRequest } from '../chat/RoomControlProtocol';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { writeConnectionStatus } from '../network/ConnectionNotices';
import { isWarpJoinPending } from '../login/WarpTransition';
import { gameRecoveryActive } from './GameRecovery';

type InviteJoin = (scene: GameScene, senderId: string, request: RoomInviteRequest) => boolean;
let join: InviteJoin | undefined;

export function acceptRoomInvite(
  scene: GameScene,
  senderId: string,
  request: RoomInviteRequest,
): boolean {
  return join?.(scene, senderId, request) ?? false;
}

/** Public receiver policy; exact Game IDs and both Service IDs are independently validated. */
export function installRoomInviteJoin(
  api: API,
  start: (scene: GameScene, destination: Room, primaryService: string) => boolean,
): void {
  const accept: InviteJoin = (scene, senderId, request) => {
    if (!isRoomOperator(senderId) || request.kind !== 'game') return false;
    const data = request.destination;
    const invalid = (reason: string) => {
      writeConnectionStatus(reason);
      return false;
    };
    if (
      request.roomId === ClientIPCService.roomId ||
      data.service === ClientIPCService.roomId ||
      data.primaryService === ClientIPCService.roomId
    )
      return invalid(ClientIPCService.reservedMessage);
    const manager = JoinRoomLocator.getService();
    const player = scene.get_me();
    if (
      !manager ||
      manager.roomStateMachine.currentRoom !== scene ||
      scene.noAutoReconnect ||
      scene.get_isLeaving() ||
      !player ||
      !scene.solarSystem ||
      !scene.room ||
      !scene.get_initialWorldIsRevealed() ||
      !scene.get_connected() ||
      !scene.serviceConnection?.get_connected() ||
      manager.serviceConnection !== scene.serviceConnection
    )
      return invalid('Room invite unavailable until both rooms are connected.');
    if (gameRecoveryActive(manager) || player.get_isWarpJumping() || isWarpJoinPending(scene))
      return invalid('Wait for the current room transition before accepting a room invite.');
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(request.roomId))
      return invalid('The invited room ID is invalid.');
    if (
      (data.systemType !== 'friendly' && data.systemType !== 'hostile') ||
      !validInvitedService(data.service) ||
      !validInvitedService(data.primaryService)
    )
      return invalid('Game invitations require a valid PvE or PvP destination.');
    const system = manager.dataManager.loadKey('SolarSystems', data.solarSystemKey);
    if (!system) return invalid('The invited solar system is unknown.');
    const destination = new Room();
    destination.id = request.roomId;
    destination.roomType = 'game';
    destination.joinOnly = true;
    destination.data = {
      solarSystemKey: data.solarSystemKey,
      systemType: data.systemType,
      service: data.service,
      pvpAboveCap: player.get_level() > system.pvpLvlCap,
    };
    destination.joinData = {
      client_version: ClientIPCService.serverVersion,
      session: manager.session,
      level: player.get_level(),
      warpJump: true,
    };
    return start(scene, destination, data.primaryService);
  };
  join = accept;
  api.defer(() => {
    if (join === accept) join = undefined;
  });
}
