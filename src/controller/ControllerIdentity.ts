export type ControllerStyle = 'auto' | 'xbox' | 'playstation' | 'generic';

export function controllerStyle(
  id: string,
  override: ControllerStyle = 'auto',
): Exclude<ControllerStyle, 'auto'> {
  if (override !== 'auto') return override;
  if (/dualsense|dualshock|playstation|\bsony\b|(?:vendor:\s*|^)(?:0?54c)(?:\b|-)/i.test(id))
    return 'playstation';
  if (/xbox|xinput|\bmicrosoft\b|(?:vendor:\s*|^)(?:0?45e)(?:\b|-)/i.test(id)) return 'xbox';
  return 'generic';
}

const xboxButtons = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'View',
  'Menu',
  'LS',
  'RS',
  'Up',
  'Down',
  'Left',
  'Right',
  'Guide',
];
const playstationButtons = [
  'Cross',
  'Circle',
  'Square',
  'Triangle',
  'L1',
  'R1',
  'L2',
  'R2',
  'Share',
  'Options',
  'L3',
  'R3',
  'Up',
  'Down',
  'Left',
  'Right',
  'PS',
  'Touchpad',
];

export function controllerButtonName(
  index: number,
  style: Exclude<ControllerStyle, 'auto'>,
): string {
  const names = style === 'xbox' ? xboxButtons : style === 'playstation' ? playstationButtons : [];
  return names[index] ?? `Button ${index}`;
}

/** Controller drift never switches prompts away from keyboard/mouse. */
export function controllerHasIntent(
  buttons: readonly { value: number }[],
  axes: readonly number[],
  deadzone: number,
): boolean {
  return (
    buttons.some((button) => button.value > 0.5) ||
    axes.some((axis) => Math.abs(axis) > Math.max(0.3, deadzone + 0.1))
  );
}
