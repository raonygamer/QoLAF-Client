import type { API } from '../api/Types';
import { GameScene, MessageLog } from '../game/Bindings';
import { ClientIPCService } from '../ipc/ClientIPCService';
import type { IPCMessage } from '../ipc/ClientIPCCodec';
import { acceptRoomInvite } from '../service/RoomInviteJoin';
import { RoomInvitations } from './RoomInvitations';
import { RoomControlSender } from './RoomControlSender';
import { disconnectRoomByOperator } from '../network/OperatorDisconnect';
import { prepareRoomControlReply } from './RoomControlReplies';
import {
  parseRoomControlRequest,
  rememberRoomControlRequest,
  roomInviteWindow,
  roomRequestWindow,
} from './RoomControlProtocol';
import {
  escapeRoomControlText,
  isRoomOperator,
  validRoomNoticeIdentity,
} from './RoomControlIdentity';

const kickNoticeType = 'qipc3.room.kickNotice';
const invitations = new WeakMap<GameScene, RoomInvitations>();
const senders = new WeakMap<GameScene, RoomControlSender>();

export function sendRoomControl(game: GameScene, argument: string, kick: boolean): void {
  senders.get(game)?.command(argument, kick);
}

export function respondToRoomInvite(game: GameScene, argument: string): void {
  invitations.get(game)?.respond(argument);
}

/** Source public receiver: notices report completed cooperative kicks, not kick requests. */
export function installNativeRoomControl(api: API, game: GameScene): void {
  const ipc = ClientIPCService.instance;
  const invites = new RoomInvitations(game, acceptRoomInvite);
  invitations.set(game, invites);
  if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__) {
    const sender = new RoomControlSender(game);
    senders.set(game, sender);
    api.defer(() => {
      sender.dispose();
      if (senders.get(game) === sender) senders.delete(game);
    });
  }
  let disposed = false;
  const ownerId = game.client.connectUserId;
  const current = () =>
    !disposed &&
    GameScene.instance === game &&
    !game.get_isLeaving() &&
    !!game.get_me() &&
    game.client.connectUserId === ownerId &&
    ClientIPCService.instance === ipc;
  const receiveInvite = (message: IPCMessage, senderId: string, senderName: string) => {
    if (!current() || !game.get_initialWorldIsRevealed() || !game.clock) return;
    const request = parseRoomControlRequest(
      message,
      senderId,
      ownerId,
      game.clock.getServerTime() / 1000,
      (key) => game.dataManager.loadKey('SolarSystems', key) !== null,
    );
    if (!request) return;
    if (request.type === 'qipc3.room.kick') {
      if (!rememberRoomControlRequest(senderId, request.nonce, roomRequestWindow)) return;
      invites.cancel();
      const receipt = prepareRoomControlReply(game, senderId, request.nonce, {
        requestType: request.type,
        result: 'received',
      });
      if (disconnectRoomByOperator(game, senderId, request.kind, request.reason)) receipt?.();
      return;
    }
    const system = game.dataManager.loadKey('SolarSystems', request.destination.solarSystemKey);
    if (!system || !rememberRoomControlRequest(senderId, request.nonce, roomInviteWindow)) return;
    invites.receive(request, senderId, senderName, system.name);
  };
  const receiveNotice = (message: IPCMessage, senderId: string, senderName: string) => {
    if (
      !current() ||
      !isRoomOperator(senderId) ||
      message.type !== kickNoticeType ||
      message.fields.length !== 2
    )
      return;
    const [targetId, targetName] = message.fields;
    if (
      typeof targetId !== 'string' ||
      typeof targetName !== 'string' ||
      !validRoomNoticeIdentity(targetId, targetName)
    )
      return;
    MessageLog.write(
      `<FONT COLOR='#ff8a8a'>${escapeRoomControlText(targetName)} was kicked from the room by ${escapeRoomControlText(senderName)}.</FONT>`,
    );
  };
  ipc?.addMessageHandler(kickNoticeType, receiveNotice);
  ipc?.addMessageHandler('qipc3.room.invite', receiveInvite);
  ipc?.addMessageHandler('qipc3.room.kick', receiveInvite);
  api.defer(() => {
    invites.dispose();
    disposed = true;
    if (invitations.get(game) === invites) invitations.delete(game);
    ipc?.removeMessageHandler(kickNoticeType, receiveNotice);
    ipc?.removeMessageHandler('qipc3.room.invite', receiveInvite);
    ipc?.removeMessageHandler('qipc3.room.kick', receiveInvite);
  });
}
