export interface RumbleActuator {
  playEffect?(
    type: 'dual-rumble',
    parameters: {
      duration: number;
      startDelay: number;
      weakMagnitude: number;
      strongMagnitude: number;
    },
  ): Promise<unknown>;
  reset?(): Promise<unknown>;
  pulse?(intensity: number, duration: number): Promise<unknown>;
}

export interface RumbleGamepad {
  vibrationActuator?: RumbleActuator | null;
  hapticActuators?: readonly RumbleActuator[];
}

export function getRumbleActuator(pad: RumbleGamepad): RumbleActuator | null {
  return (
    [pad.vibrationActuator, ...(pad.hapticActuators ?? [])].find(
      (actuator) =>
        actuator &&
        (typeof actuator.playEffect === 'function' || typeof actuator.pulse === 'function'),
    ) ?? null
  );
}

export async function resetRumble(actuator: RumbleActuator | null): Promise<void> {
  if (actuator?.reset) await actuator.reset();
  else if (actuator?.pulse) await actuator.pulse(0, 0);
}

export async function playRumble(
  actuator: RumbleActuator,
  weak: number,
  strong: number,
): Promise<void> {
  if (!weak && !strong) {
    await resetRumble(actuator);
    return;
  }
  if (actuator.playEffect)
    await actuator.playEffect('dual-rumble', {
      duration: 100,
      startDelay: 0,
      weakMagnitude: weak,
      strongMagnitude: strong,
    });
  else if (actuator.pulse) await actuator.pulse(Math.max(weak, strong), 100);
}
