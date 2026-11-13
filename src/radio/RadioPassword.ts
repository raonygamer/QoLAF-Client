import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

/** Original group access proof; this does not encrypt media or IPC traffic. */
export class RadioPassword {
  static valid(password: unknown): password is string {
    return (
      typeof password === 'string' && password.length <= 64 && !/[\x00-\x1f\x7f]/.test(password)
    );
  }

  static key(password: string, roomId: string): string {
    if (password === '') return '';
    const text = 'qolaf-radio-password-v1\n' + roomId + '\n' + password;
    // as3corelib SHA256.hash masks each UTF-16 code unit to eight bits.
    // Iterate code units, not Unicode code points (including surrogate pairs).
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 255;
    return bytesToHex(sha256(bytes));
  }

  static proof(
    key: string,
    hostSession: string,
    roomId: string,
    playerId: string,
    session: string,
  ): string {
    if (key === '') return '';
    const data = new TextEncoder().encode(
      'qolaf-radio-join-v1\n' + hostSession + '\n' + roomId + '\n' + playerId + '\n' + session,
    );
    return bytesToHex(hmac(sha256, hexToBytes(key), data));
  }

  static matches(expected: string, received: unknown): boolean {
    if (typeof received !== 'string' || received.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < expected.length; i++)
      difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
    return difference === 0;
  }
}
