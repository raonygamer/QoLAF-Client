import type { IPCMessage } from '../ipc/ClientIPCCodec';
import { ClientIPCService } from '../ipc/ClientIPCService';
import { isRoomOperator } from './RoomControlIdentity';

export const roomRequestWindow = 30000;
export const roomInviteWindow = 180000;
const clockSkewSeconds = 5;
const noncePattern = /^[A-F0-9]{32}$/;

interface RoomRequestHeader {
  kind: 'game';
  recipientId: string;
  nonce: string;
  sentAt: number;
}

export interface RoomInviteDestination {
  solarSystemKey: string;
  systemType: 'friendly' | 'hostile';
  service: string;
  primaryService: string;
}

export interface RoomInviteRequest extends RoomRequestHeader {
  type: 'qipc3.room.invite';
  roomId: string;
  destination: RoomInviteDestination;
}

export interface RoomKickRequest extends RoomRequestHeader {
  type: 'qipc3.room.kick';
  reason: string;
}

export type RoomControlRequest = RoomInviteRequest | RoomKickRequest;
export type RoomControlReply = RoomRequestHeader & { requestNonce: string } & (
    | { requestType: 'qipc3.room.invite'; result: 'accepted' | 'declined' }
    | { requestType: 'qipc3.room.kick'; result: 'received' }
  );

function readHeader(
  message: IPCMessage,
  recipientId: string,
  now: number,
  windowMs: number,
): RoomRequestHeader | null {
  const fields = message.fields;
  if (
    fields.length < 5 ||
    fields.length > 9 ||
    fields[0] !== 'game' ||
    fields[1] !== recipientId ||
    typeof fields[2] !== 'string' ||
    !noncePattern.test(fields[2]) ||
    typeof fields[3] !== 'number' ||
    !Number.isFinite(now) ||
    !Number.isFinite(fields[3]) ||
    fields[3] > now + clockSkewSeconds ||
    fields[3] + windowMs / 1000 <= now
  )
    return null;
  return { kind: 'game', recipientId, nonce: fields[2], sentAt: fields[3] };
}

export function validInvitedService(id: string): boolean {
  const prefix = `Service-${ClientIPCService.serverVersion}_`;
  if (!id.startsWith(prefix) || id === ClientIPCService.roomId) return false;
  const index = id.slice(prefix.length);
  return /^(0|[1-9][0-9]*)$/.test(index) && Number(index) <= 2147483647;
}

export function clampRoomKickReason(value: string): string {
  let result = value
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30);
  const last = result.charCodeAt(result.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) result = result.slice(0, -1);
  return result.trim();
}

/** Parse only authenticated operator requests; names and role flags confer no authority. */
export function parseRoomControlRequest(
  message: IPCMessage,
  senderId: string,
  recipientId: string,
  serverSeconds: number,
  systemExists: (key: string) => boolean,
): RoomControlRequest | null {
  if (!isRoomOperator(senderId)) return null;
  const windowMs = message.type === 'qipc3.room.invite' ? roomInviteWindow : roomRequestWindow;
  const header = readHeader(message, recipientId, serverSeconds, windowMs);
  if (!header) return null;
  const fields = message.fields;
  if (message.type === 'qipc3.room.kick') {
    const reason = fields[4];
    if (
      fields.length !== 5 ||
      typeof reason !== 'string' ||
      !reason ||
      clampRoomKickReason(reason) !== reason
    )
      return null;
    return { ...header, type: message.type, reason };
  }
  if (message.type !== 'qipc3.room.invite' || fields.length !== 9) return null;
  const [, , , , roomId, solarSystemKey, systemType, service, primaryService] = fields;
  if (
    typeof roomId !== 'string' ||
    !/^[A-Za-z0-9_.:-]{1,80}$/.test(roomId) ||
    typeof solarSystemKey !== 'string' ||
    (systemType !== 'friendly' && systemType !== 'hostile') ||
    typeof service !== 'string' ||
    !validInvitedService(service) ||
    typeof primaryService !== 'string' ||
    !validInvitedService(primaryService)
  )
    return null;
  try {
    if (!systemExists(solarSystemKey)) return null;
  } catch {
    return null;
  }
  return {
    ...header,
    type: message.type,
    roomId,
    destination: { solarSystemKey, systemType, service, primaryService },
  };
}

/** Correlation with the recorded recipient/request must precede replay-cache insertion. */
export function parseRoomControlReply(
  message: IPCMessage,
  recipientId: string,
  serverSeconds: number,
): RoomControlReply | null {
  if (message.type !== 'qipc3.room.reply' || message.fields.length !== 7) return null;
  const header = readHeader(message, recipientId, serverSeconds, roomRequestWindow);
  if (!header) return null;
  const [, , , , requestNonce, requestType, result] = message.fields;
  if (typeof requestNonce !== 'string' || !noncePattern.test(requestNonce)) return null;
  if (requestType === 'qipc3.room.invite' && (result === 'accepted' || result === 'declined'))
    return { ...header, requestNonce, requestType, result };
  if (requestType === 'qipc3.room.kick' && result === 'received')
    return { ...header, requestNonce, requestType, result };
  return null;
}

// Module ownership deliberately survives Game/composer recreation. Never evict
// an unexpired nonce to accept a new request, including under a packet flood.
const seen = new Map<string, number>();

export function rememberRoomControlRequest(
  senderId: string,
  nonce: string,
  windowMs = roomRequestWindow,
): boolean {
  if (
    !noncePattern.test(nonce) ||
    (windowMs !== roomRequestWindow && windowMs !== roomInviteWindow)
  )
    return false;
  const now = performance.now();
  for (const [key, expiresAt] of seen) if (now >= expiresAt) seen.delete(key);
  const key = senderId + ':' + nonce;
  if (seen.has(key) || seen.size >= 512) return false;
  seen.set(key, now + windowMs + clockSkewSeconds * 1000);
  return true;
}
