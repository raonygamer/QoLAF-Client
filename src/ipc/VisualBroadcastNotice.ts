import { MessageLog } from '../game/Bindings';

export type VisualBroadcastResult =
  | 'busy'
  | 'unavailable'
  | 'encoding'
  | 'queued'
  | 'sent'
  | 'failed';

/** Private /ssv all feedback; automatic sharing remains silent. */
export function writeVisualBroadcastNotice(result: VisualBroadcastResult): void {
  switch (result) {
    case 'busy':
      MessageLog.write('A client IPC visual broadcast is already queued or sending.');
      break;
    case 'unavailable':
      MessageLog.write(
        '[error] Wait until the client IPC connection and your ship are ready before sharing.',
        'error',
      );
      break;
    case 'encoding':
      MessageLog.write(
        '[error] Your current visual could not be encoded for synchronization.',
        'error',
      );
      break;
    case 'queued':
      MessageLog.write('Queued your visual for everyone connected to client IPC.');
      break;
    case 'sent':
      MessageLog.write('Your visual was broadcast to everyone connected to client IPC.');
      break;
    case 'failed':
      MessageLog.write(
        '[error] Your visual broadcast could not be completed. Check the client IPC connection, then try again.',
        'error',
      );
      break;
  }
}
