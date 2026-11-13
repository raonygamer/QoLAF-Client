import type { ControllerSettings } from './ControllerSettings';
import type { DualSenseHID } from './DualSenseHID';

let settings: ControllerSettings | null = null;
let hid: DualSenseHID | null = null;
export function controllerSettings(): ControllerSettings | null {
  return settings;
}
export function controllerHID(): DualSenseHID | null {
  return hid;
}
export function registerControllerContext(
  nextSettings: ControllerSettings,
  nextHID: DualSenseHID,
): () => void {
  settings = nextSettings;
  hid = nextHID;
  return () => {
    if (settings === nextSettings) settings = null;
    if (hid === nextHID) hid = null;
  };
}
