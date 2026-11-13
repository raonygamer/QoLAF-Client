import type { ControllerBinding, ControllerSnapshot } from './ControllerInput';

/** Require a neutral input before accepting its next press, avoiding held/drifting axes. */
export class ControllerCapture {
  private neutral = new Set<string>();

  sample(snapshot: ControllerSnapshot): ControllerBinding | null {
    for (let index = 0; index < snapshot.buttons.length; index++) {
      const value = snapshot.buttons[index].value;
      const key = `button:${index}`;
      if (value < 0.2) this.neutral.add(key);
      else if (value > 0.7 && this.neutral.has(key)) return { kind: 'button', index };
    }
    for (let index = 0; index < snapshot.axes.length; index++) {
      const value = snapshot.axes[index];
      const key = `axis:${index}`;
      if (Math.abs(value) < 0.25) this.neutral.add(key);
      else if (Math.abs(value) > 0.7 && this.neutral.has(key))
        return { kind: 'axis', index, direction: value > 0 ? 1 : -1 };
    }
    return null;
  }
}

let capturing = false;
export function setControllerCapture(active: boolean): void {
  capturing = active;
}
export function isControllerCaptureActive(): boolean {
  return capturing;
}
