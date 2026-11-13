import assert from 'node:assert/strict';
import test from 'node:test';
import { getRumbleActuator, playRumble, resetRumble } from '../src/controller/ControllerRumble';

test('legacy pulse actuator receives combined intensity and a zero pulse on reset', async () => {
  const pulses: number[][] = [];
  const actuator = {
    async pulse(value: number, duration: number) {
      pulses.push([value, duration]);
    },
  };
  assert.equal(getRumbleActuator({ hapticActuators: [actuator] }), actuator);
  await playRumble(actuator, 0.3, 0.6);
  await resetRumble(actuator);
  assert.deepEqual(pulses, [
    [0.6, 100],
    [0, 0],
  ]);
});

test('dual-rumble preserves separate motors and does not require a legacy actuator', async () => {
  let values: number[] = [];
  let resets = 0;
  const actuator = {
    async playEffect(
      _type: string,
      parameters: { weakMagnitude: number; strongMagnitude: number },
    ) {
      values = [parameters.weakMagnitude, parameters.strongMagnitude];
    },
    async reset() {
      resets++;
    },
  };
  assert.equal(getRumbleActuator({ vibrationActuator: actuator }), actuator);
  await playRumble(actuator, 0.2, 0.8);
  await playRumble(actuator, 0, 0);
  assert.deepEqual(values, [0.2, 0.8]);
  assert.equal(resets, 1);
  assert.equal(getRumbleActuator({}), null);
});
