import { controllerHID } from './ControllerContext';
import type { RumbleGamepad } from './ControllerRumble';
export type ControllerDevice = Pick<
  Gamepad,
  'id' | 'index' | 'connected' | 'axes' | 'buttons' | 'mapping' | 'timestamp'
> &
  RumbleGamepad;
import { hasControllerFocus } from './ControllerFocus';
interface PolicyDocument extends Document {
  permissionsPolicy?: { allowsFeature(feature: string): boolean };
  featurePolicy?: { allowsFeature(feature: string): boolean };
}

export function readControllers(): readonly (ControllerDevice | null)[] {
  let pads: (ControllerDevice | null)[] = [];
  try {
    pads = Array.from(navigator.getGamepads?.() ?? []);
  } catch {
    /* HID can remain available. */
  }
  const hid = controllerHID();
  if (!hid?.hasInput) return pads;
  const matching = pads.findIndex(
    (pad) => pad && /054c|dualsense|wireless controller/i.test(pad.id),
  );
  const vacant = pads.findIndex((pad) => !pad);
  const index = matching >= 0 ? matching : vacant >= 0 ? vacant : pads.length;
  const sample = hid.inputSnapshot();
  // Never replay a stale native snapshot after the HID stream stops.
  pads[index] = sample
    ? {
        id: hid.inputName,
        index,
        connected: true,
        mapping: 'standard',
        timestamp: performance.now(),
        axes: sample.axes,
        buttons: sample.buttons.map((button) => ({
          value: button.value,
          pressed: button.value >= 0.5,
          touched: button.value > 0,
        })),
      }
    : null;
  return pads;
}

export function selectController(
  pads: readonly (ControllerDevice | null)[],
  index: number,
  previous: number | null = null,
): ControllerDevice | null {
  if (index >= 0) return pads[index] ?? null;
  return (
    pads.find((pad) => pad?.connected && pad.id.endsWith('(WebHID)')) ??
    (previous === null ? null : pads[previous]) ??
    pads.find((pad) => pad?.connected) ??
    null
  );
}

export function controllerStatus(enabled: boolean, index: number): string {
  const policy =
    (document as PolicyDocument).permissionsPolicy ?? (document as PolicyDocument).featurePolicy;
  if (policy && !policy.allowsFeature('gamepad')) return 'Gamepad blocked by page permissions';
  if (!navigator.getGamepads) return 'Gamepad API unavailable';
  let pads: readonly (ControllerDevice | null)[];
  try {
    pads = readControllers();
  } catch (error) {
    return `Gamepad access failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (!enabled) return 'Controller input is Off in this browser';
  const pad = selectController(pads, index);
  if (!pad?.connected) {
    const connected = pads.filter((candidate) => candidate?.connected);
    return connected.length
      ? `Controller index ${index} missing; choose Automatic`
      : 'No controller exposed - focus game and press a controller button';
  }
  if (document.hidden || !hasControllerFocus()) return `Controller ${pad.index}: game is unfocused`;
  return `Controller ${pad.index}: ${pad.id} (${pad.mapping || 'unmapped'})`;
}
