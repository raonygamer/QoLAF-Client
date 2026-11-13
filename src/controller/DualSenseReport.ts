/*!
 * MIT License
 *
 * Copyright (c) 2021-2022 John "Nielk1" Klein
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/** DualSense output protocol: nondebug/dualsense; trigger encodings: Nielk1.
 * See docs/ControllerLicenses.txt for attribution and the MIT trigger license. */
export type TriggerEffect =
  | { kind: 'off' }
  | { kind: 'resistance'; start: number; strength: number }
  | { kind: 'weapon'; start: number; end: number; strength: number }
  | { kind: 'vibration'; start: number; strength: number; frequency: number };

export interface DualSenseOutput {
  left: TriggerEffect;
  right: TriggerEffect;
  light?: readonly [number, number, number];
  population?: number;
  weak: number;
  strong: number;
  releaseLights?: boolean;
}

export function encodeTrigger(effect: TriggerEffect): Uint8Array {
  const bytes = new Uint8Array(11);
  bytes[0] = 0x05;
  if (effect.kind === 'off') return bytes;
  const strength = integer(effect.strength * 8, 0, 8);
  if (!strength) return bytes;
  const view = new DataView(bytes.buffer);
  if (effect.kind === 'weapon') {
    const start = integer(effect.start, 2, 7);
    const end = integer(effect.end, start + 1, 8);
    bytes[0] = 0x25;
    view.setUint16(1, (1 << start) | (1 << end), true);
    bytes[3] = strength - 1;
  } else {
    const frequency = effect.kind === 'vibration' ? integer(effect.frequency, 0, 255) : 0;
    if (effect.kind === 'vibration' && !frequency) return bytes;
    bytes[0] = effect.kind === 'resistance' ? 0x21 : 0x26;
    let zones = 0;
    let forces = 0;
    for (let zone = integer(effect.start, 0, 9); zone < 10; zone++) {
      zones |= 1 << zone;
      forces |= (strength - 1) << (zone * 3);
    }
    view.setUint16(1, zones, true);
    view.setUint32(3, forces, true);
    bytes[9] = frequency;
  }
  return bytes;
}

export function encodeDualSenseReport(
  output: DualSenseOutput,
  bluetooth: boolean,
  sequence = 0,
): { id: number; data: Uint8Array<ArrayBuffer> } {
  const data = new Uint8Array(bluetooth ? 77 : 47);
  const offset = bluetooth ? 2 : 0;
  if (bluetooth) {
    data[0] = (sequence & 15) << 4;
    data[1] = 0x10;
  }
  const common = data.subarray(offset, offset + 47);
  // Change only motors, triggers and explicitly enabled lighting. Leave audio/mic alone.
  common[0] = 0x0f;
  common[1] =
    (output.light ? 0x04 : 0) |
    (output.population !== undefined ? 0x10 : 0) |
    (output.releaseLights ? 0x08 : 0);
  common[2] = integer(output.weak * 255, 0, 255);
  common[3] = integer(output.strong * 255, 0, 255);
  common.set(encodeTrigger(output.right), 10);
  common.set(encodeTrigger(output.left), 21);
  if (output.light) {
    common[39] = 0x02;
    common[41] = 0x02;
    common.set(
      output.light.map((value) => integer(value, 0, 255)),
      44,
    );
  }
  if (output.population !== undefined) {
    // Symmetric player-indicator patterns: 0, 1, 2, 3, 4, 5 illuminated LEDs.
    common[43] = [0, 0x04, 0x0a, 0x15, 0x1b, 0x1f][integer(output.population, 0, 5)];
  }
  const id = bluetooth ? 0x31 : 0x02;
  if (bluetooth) {
    const crc = crc32(new Uint8Array([0xa2, id, ...data.subarray(0, 73)]));
    new DataView(data.buffer).setUint32(73, crc, true);
  }
  return { id, data };
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function integer(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.round(value))) : minimum;
}
