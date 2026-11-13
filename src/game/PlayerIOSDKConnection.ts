import type { PlayerIOSDKMessage } from './PlayerIOMessageSerializer';

/** SDK connection members used beneath the current Haxe Connection wrapper. */
export interface PlayerIOSDKConnection {
  readonly connected: boolean;
  sendMessage(message: PlayerIOSDKMessage): void;
}
