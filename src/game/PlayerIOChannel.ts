import type { PlayerIOMessageSerializer } from './PlayerIOMessageSerializer';

/** Authentication response decoded by the bundled SDK's channel.call. */
export interface AuthenticationResponse {
  token: string;
  userid: string;
  gamefsredirectmap?: string;
}

/** Verified against the locally cached PlayerIOClient.minified.js. */
export interface PlayerIOChannel {
  token?: string;
  kongregateConnect<T>(
    gameId: string,
    userId: string,
    gameAuthToken: string,
    segments: string[],
    clientAPI: string,
    clientInfo: Record<string, string>,
    success: (client: T) => void,
    failure: (error: unknown) => void,
    convert: (response: AuthenticationResponse) => T,
  ): void;
  connect<T>(
    gameId: string,
    connectionId: string,
    userId: string,
    auth: string,
    partnerId: string,
    segments: string[],
    clientAPI: string,
    clientInfo: Record<string, string>,
    success: (client: T) => void,
    failure: (error: unknown) => void,
    convert: (response: AuthenticationResponse) => T,
  ): void;
}

declare global {
  var _pio:
    | {
        channel: new () => PlayerIOChannel;
        messageSerializer?: new () => PlayerIOMessageSerializer;
        binaryserializer?: import('../network/PlayerIOUnicode').PlayerIOStringEncoder;
      }
    | undefined;
}

export function createPlayerIOChannel(): PlayerIOChannel {
  if (!globalThis._pio) throw new Error('PlayerIO SDK has not loaded.');
  return new globalThis._pio.channel();
}
