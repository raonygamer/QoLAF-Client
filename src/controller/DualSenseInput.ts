import type { ControllerSnapshot } from './ControllerInput';

/** DualSense USB, Bluetooth basic and Bluetooth enhanced input layouts.
 * Protocol reference: https://github.com/nondebug/dualsense (input report documentation).
 */
export function decodeDualSenseInput(reportId: number, data: DataView): ControllerSnapshot | null {
  const basic = reportId === 1 && data.byteLength === 9;
  const offset = reportId === 0x31 ? 1 : 0;
  if (
    !basic &&
    !((reportId === 1 && data.byteLength === 63) || (reportId === 0x31 && data.byteLength === 77))
  )
    return null;
  const read = (index: number) => data.getUint8(offset + index);
  const axis = (value: number) => (value < 128 ? (value - 128) / 128 : (value - 128) / 127);
  const face = read(basic ? 4 : 7);
  const shoulders = read(basic ? 5 : 8);
  const extra = read(basic ? 6 : 9);
  const dpad = face & 15;
  const values = [
    Number(!!(face & 32)),
    Number(!!(face & 64)),
    Number(!!(face & 16)),
    Number(!!(face & 128)),
    Number(!!(shoulders & 1)),
    Number(!!(shoulders & 2)),
    read(basic ? 7 : 4) / 255,
    read(basic ? 8 : 5) / 255,
    Number(!!(shoulders & 16)),
    Number(!!(shoulders & 32)),
    Number(!!(shoulders & 64)),
    Number(!!(shoulders & 128)),
    Number([0, 1, 7].includes(dpad)),
    Number([3, 4, 5].includes(dpad)),
    Number([5, 6, 7].includes(dpad)),
    Number([1, 2, 3].includes(dpad)),
    Number(!!(extra & 1)),
    Number(!!(extra & 2)),
    Number(!!(extra & 4)),
  ];
  return {
    axes: [0, 1, 2, 3].map((index) => axis(read(index))),
    buttons: values.map((value) => ({ value })),
  };
}
