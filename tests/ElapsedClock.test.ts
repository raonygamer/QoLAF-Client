import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-expect-error original AS3 execution boundary
import { install } from './fixtures/As3Methods.js';
import { test } from 'node:test';
import { ElapsedClock } from '../src/clock/ElapsedClock';
import { updateSimulation, resetSimulationTiming } from '../src/rendering/SimulationTiming';

test('wall-clock corrections cannot stall or burst elapsed-time simulation', () => {
  const beginning = 1_700_000_000_000;
  let wall = beginning + 120;
  let monotonic = 500;
  const clock = new ElapsedClock(wall - beginning, () => monotonic);
  let ticks = 0;
  let renders = 0;
  const machine = {
    _clock: { get_elapsedTime: () => clock.read() },
    newTime: 0,
    currentTime: 0,
    frameTime: 0,
    accumulator: 0,
    currentState: {
      get_loaded: () => true,
      tickUpdate: () => ticks++,
      execute: () => renders++,
    },
    previousState: null,
    inputManager: { reset() {} },
  };
  resetSimulationTiming(machine);
  assert.equal(machine.currentTime, 120, 'retain the clock origin when attaching');

  wall -= 60_000;
  monotonic += 16.5;
  updateSimulation(machine);
  assert.equal(wall - beginning, -59_880, 'native wall-clock elapsed would go backwards');
  assert.equal(machine.frameTime, 16.5);
  assert.equal(ticks, 0);

  wall += 3_600_000;
  monotonic += 16.5;
  updateSimulation(machine);
  assert.equal(machine.frameTime, 16.5);
  assert.equal(machine.accumulator, 0);
  assert.equal(ticks, 1, 'wall-clock jump must not trigger capped catch-up ticks');
  assert.equal(renders, 2);

  monotonic += 10_000;
  resetSimulationTiming(machine);
  updateSimulation(machine);
  assert.equal(ticks, 1, 'room initialization reset still discards elapsed setup time');

  const other = new ElapsedClock(0, () => monotonic);
  monotonic += 33;
  assert.equal(other.read(), 33, 'each room clock retains its own origin');
  assert.equal(clock.read(), 10_186);
});

test('simulation timing matches original source through stalls, unloaded screens and absent clocks', () => {
  const source = readFileSync(
    new URL('./fixtures/landed/GameStateMachine.as', import.meta.url),
    'utf8',
  );
  for (const clockPresent of [false, true])
    for (const currentPresent of [false, true])
      for (const loaded of [false, true])
        for (const previous of ['none', 'loaded', 'unloaded'])
          for (const remainder of [0, 16, 32]) {
            const create = () => {
              const events: string[] = [];
              const clock = {
                elapsedTime: 1000,
                get_elapsedTime() {
                  return this.elapsedTime;
                },
              };
              return {
                events,
                clock,
                _clock: clockPresent ? clock : null,
                newTime: 1000,
                currentTime: 1000,
                frameTime: 0,
                accumulator: remainder,
                currentState: currentPresent
                  ? {
                      loaded,
                      get_loaded: () => loaded,
                      tickUpdate: () => events.push('tick'),
                      execute: () => events.push('draw'),
                    }
                  : null,
                previousState:
                  previous === 'none'
                    ? null
                    : {
                        unloaded: previous === 'unloaded',
                        get_unloaded: () => previous === 'unloaded',
                      },
                inputManager: { reset: () => events.push('input') },
                update() {},
                resetTiming() {},
              };
            };
            const expected = create(),
              actual = create();
            install(expected, source, ['update', 'resetTiming']);
            for (const elapsed of [1000, 1005.5, 1011, 1033, 1100, 1090, 5000, 5005.5]) {
              expected.clock.elapsedTime = actual.clock.elapsedTime = elapsed;
              expected.update();
              updateSimulation(actual);
              assert.deepEqual(actual.events, expected.events);
              for (const key of ['accumulator', 'newTime', 'currentTime', 'frameTime'] as const)
                assert.equal(actual[key], expected[key], key);
            }
            expected.resetTiming();
            resetSimulationTiming(actual);
            for (const key of ['accumulator', 'newTime', 'currentTime', 'frameTime'] as const)
              assert.equal(actual[key], expected[key], key);
          }
});
