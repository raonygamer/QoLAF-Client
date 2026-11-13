export type ControllerBinding =
  | { kind: 'button'; index: number }
  | { kind: 'axis'; index: number; direction: 1 | -1 };

export interface ControllerMapping {
  action: number;
  binding: ControllerBinding;
}

export interface ControllerThresholds {
  deadzone: number;
  press: number;
  release: number;
  exponent: number;
}

export interface ControllerSnapshot {
  axes: readonly number[];
  buttons: readonly { value: number }[];
}

/** Keep transitions until the simulation consumes them, even at high display FPS. */
export class ControllerInput {
  private held = new Set<number>();
  private pressed = new Set<number>();
  private bindingHeld = new Set<number>();

  update(
    snapshot: ControllerSnapshot | null,
    mappings: readonly ControllerMapping[],
    thresholds: ControllerThresholds,
  ): void {
    if (!snapshot) {
      this.clear();
      return;
    }
    const next = new Set<number>();
    const nextBindings = new Set<number>();
    const press = clamp(thresholds.press, 0.01, 1);
    const release = clamp(thresholds.release, 0, press - 0.001);
    mappings.forEach(({ action, binding }, index) => {
      const value =
        binding.kind === 'button'
          ? clamp(snapshot.buttons[binding.index]?.value ?? 0, 0, 1)
          : Math.max(
              0,
              shapeAxis(snapshot.axes[binding.index] ?? 0, thresholds) * binding.direction,
            );
      const active = this.bindingHeld.has(index) ? value > release : value >= press;
      if (active) {
        nextBindings.add(index);
        next.add(action);
      }
    });
    for (const action of next) if (!this.held.has(action)) this.pressed.add(action);
    this.bindingHeld = nextBindings;
    this.held = next;
  }

  isDown(action: number): boolean {
    return this.held.has(action);
  }

  isPressed(action: number): boolean {
    return this.pressed.has(action);
  }

  finishTick(): void {
    this.pressed.clear();
  }

  clear(): void {
    this.held.clear();
    this.pressed.clear();
    this.bindingHeld.clear();
  }
}

export function shapeAxis(value: number, settings: ControllerThresholds): number {
  if (!Number.isFinite(value)) return 0;
  const deadzone = clamp(settings.deadzone, 0, 0.95);
  const magnitude = Math.abs(clamp(value, -1, 1));
  if (magnitude <= deadzone) return 0;
  return (
    Math.sign(value) *
    Math.pow((magnitude - deadzone) / (1 - deadzone), clamp(settings.exponent, 0.25, 4))
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum;
}

/** Cycle actual available hotkeys, preserving direct weapon button bindings. */
export function cycleWeapon(
  hotkeys: readonly number[],
  selected: number,
  direction: 1 | -1,
): number | null {
  const available = [...new Set(hotkeys)]
    .filter((key) => Number.isInteger(key) && key > 0)
    .sort((a, b) => a - b);
  if (!available.length) return null;
  const index = available.indexOf(selected);
  if (index < 0) return direction > 0 ? available[0] : available[available.length - 1];
  return available[(index + direction + available.length) % available.length];
}
