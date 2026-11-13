import { ClientIPCCodec, type IPCMessage } from './ClientIPCCodec';
import { ClientIPCMessagePack } from './ClientIPCMessagePack';

export type IPCChannel = 'local' | 'private';
export type IPCTarget = 'broadcastLocal' | 'peerMessage';

/** Source allowlists: application packets cannot masquerade as discovery. */
export class ClientIPCPolicy {
  static applicationAllowed(type: string, channel: IPCChannel): boolean {
    if (
      typeof type !== 'string' ||
      !type.startsWith(ClientIPCCodec.prefix) ||
      type.startsWith('qipc3.ipc.') ||
      type === ClientIPCMessagePack.type
    )
      return false;
    if (type.startsWith('qipc3.radio.')) {
      const operation = type.slice('qipc3.radio.'.length);
      return (
        channel === 'local'
          ? ['discover', 'advertise', 'close', 'leader', 'takeover']
          : [
              'advertise',
              'join',
              'leave',
              'request',
              'state',
              'timeline',
              'ready',
              'requestResult',
              'control',
              'controlResult',
              'joinResult',
              'handoff',
              'handoffReady',
              'kick',
              'invite',
              'inviteReply',
              'inviteJoin',
            ]
      ).includes(operation);
    }
    const broadcastOnly = [
      'qipc3.chat.qolaf',
      'qipc3.pod.rare',
      'qipc3.artifact.rare',
      'qipc3.purchase',
      'qipc3.client.echoQuery',
      'qipc3.room.kickNotice',
      'qipc3.emperor.status',
      'qipc3.emperor.trioDefeated',
    ];
    return channel === 'local'
      ? type === 'qipc3.visual.share' || broadcastOnly.includes(type)
      : !broadcastOnly.includes(type);
  }

  static decodedAllowed(message: IPCMessage, channel: IPCChannel): boolean {
    if (message.type === 'qipc3.ipc.hello') return channel === 'local';
    if (message.type === 'qipc3.ipc.helloAck') return channel === 'private';
    if (message.type === 'qipc3.ipc.presence' || message.type === 'qipc3.ipc.bye')
      return channel === 'local';
    return this.applicationAllowed(message.type, channel);
  }

  static validIdentity(id: unknown, name: unknown): id is string {
    return (
      typeof id === 'string' &&
      id.length > 0 &&
      id.length <= 128 &&
      typeof name === 'string' &&
      name.length > 0 &&
      name.length <= 100 &&
      !/[\x00-\x1f\x7f]/.test(id + name)
    );
  }

  static validVersion(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length <= 14 &&
      !/[^0-9.]/.test(value) &&
      /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/.test(value)
    );
  }

  static validBuild(value: unknown): value is 'Public' | 'Private' {
    return value === 'Public' || value === 'Private';
  }

  static validHandshake(fields: unknown[], playerId: string): boolean {
    if (fields.length < 19 || fields[0] !== playerId) return false;
    for (const index of [1, 5, 6, 7, 8, 10, 11, 12]) {
      const value = fields[index];
      if (typeof value !== 'number' || !Number.isFinite(value) || value !== (value | 0))
        return false;
    }
    for (const index of [3, 4, 9])
      if (typeof fields[index] !== 'number' || !Number.isFinite(fields[index])) return false;
    for (const index of [2, 13, 14, 15, 16, 17, 18])
      if (typeof fields[index] !== 'string') return false;
    return true;
  }
}
