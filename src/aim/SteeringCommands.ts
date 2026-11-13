export interface SteeringCommand {
  type: 1 | 2;
  active: boolean;
}

/** Source updateMouseAim: release opposite steering before starting a turn; stop releases both axes. */
export function steeringCommands(
  left: boolean,
  right: boolean,
  error: number,
  threshold: number,
  settle = false,
): SteeringCommand[] {
  if (settle || (error < threshold && error > -threshold)) {
    const commands: SteeringCommand[] = [];
    if (left) commands.push({ type: 1, active: false });
    if (right) commands.push({ type: 2, active: false });
    return commands;
  }
  if (error > threshold) {
    if (right) return [{ type: 2, active: false }];
    if (!left) return [{ type: 1, active: true }];
  } else if (error < -threshold) {
    if (left) return [{ type: 1, active: false }];
    if (!right) return [{ type: 2, active: true }];
  }
  return [];
}
