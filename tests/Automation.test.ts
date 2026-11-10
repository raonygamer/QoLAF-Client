import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AutomationEvent } from '../src/Automation/AutomationEvent';
import { AutomationInfo } from '../src/Automation/AutomationInfo';
import { AutomationRuntime } from '../src/Automation/AutomationRuntime';
import { EventBus, type AutomationCommands } from '../src/Automation/EventBus';

function registry() {
  const calls: unknown[][] = [];
  const commands: AutomationCommands = {
    registerOwnedCommand: (...args) => {
      calls.push(['register', ...args]);
      return args[1];
    },
    unregisterOwnedCommand: (...args) => {
      calls.push(['unregister', ...args]);
      return true;
    },
    unregisterOwner: (owner) => {
      calls.push(['owner', owner]);
    },
    unregisterNamespace: (name) => {
      calls.push(['namespace', name]);
    },
  };
  return { calls, commands };
}
const info = new AutomationInfo('Example', 'Description', '1.0', ['Author'], 2);

test('source automation metadata/event arrays are defensive and only commands can be handled', () => {
  const authors = ['One'];
  const metadata = new AutomationInfo('Name', '', '1', authors, 7);
  authors.push('Two');
  metadata.authors.push('Three');
  assert.deepEqual(metadata.authors, ['One']);
  assert.equal(metadata.min_client_version, 7);
  const args = ['first'];
  const event = new AutomationEvent('command', 'example', {}, 0, 'run', args);
  args.push('second');
  event.commandArguments.push('third');
  assert.deepEqual(event.commandArguments, ['first']);
  event.markHandled();
  assert.equal(event.handled, true);
  const update = new AutomationEvent('update', 'example', {}, 33);
  update.markHandled();
  assert.equal(update.handled, false);
});

test('event bus preserves source listener snapshot, arity, namespace ownership and disposal', () => {
  const { commands, calls } = registry();
  const bus = new EventBus('Example', commands);
  const order: string[] = [];
  const second = () => {
    order.push('second');
  };
  const third = () => {
    order.push('third');
  };
  bus.subscribe('update', function () {
    assert.equal(arguments.length, 0);
    order.push('first');
    bus.unsubscribe('update', second);
    bus.subscribe('update', third);
  });
  bus.subscribe('update', second);
  bus.subscribe('update', second);
  bus.dispatch(new AutomationEvent('update', 'Example', {}));
  assert.deepEqual(order, ['first', 'second']);
  order.length = 0;
  bus.dispatch(new AutomationEvent('update', 'Example', {}));
  assert.deepEqual(order, ['first', 'third']);
  assert.equal(
    bus.registerCommand(' EXAMPLE:Help ', {}, () => {}),
    'example:help',
  );
  assert.throws(() => bus.registerCommand('other:help', {}, () => {}), /namespace/);
  bus.renderWhileStopped = true;
  bus.dispose();
  bus.dispose();
  assert.equal(calls.filter((call) => call[0] === 'owner').length, 1);
  assert.equal(calls.filter((call) => call[0] === 'namespace').length, 1);
  assert.equal(bus.renderWhileStopped, false);
  assert.throws(() => bus.subscribe('update', () => {}), /disposed/);
  assert.throws(() => {
    bus.renderWhileStopped = true;
  }, /disposed/);
  assert.equal(bus.unregisterCommand('other:help'), false);
});

test('automation lifecycle retains stopped commands/rendering and creates fresh room runtimes', () => {
  const { commands } = registry();
  const events: AutomationEvent[] = [];
  const buses: EventBus[] = [];
  let releases = 0;
  let game: object | null = {};
  class Script {
    constructor(bus: EventBus) {
      buses.push(bus);
      bus.renderWhileStopped = true;
      for (const type of ['initialize', 'start', 'stop', 'update', 'render', 'command', 'dispose'])
        bus.subscribe(type, (event: AutomationEvent) => {
          events.push(event);
          event.markHandled();
        });
    }
    getInfo() {
      return info;
    }
  }
  const runtime = new AutomationRuntime(
    'example',
    info,
    Script,
    commands,
    () => game,
    () => {
      releases++;
    },
    () => assert.fail('unexpected script error'),
  );
  assert.equal(runtime.initialize(), true);
  assert.equal(runtime.start(), true);
  assert.equal(runtime.start(), false);
  runtime.update(33);
  runtime.render(16);
  assert.equal(runtime.stop(), true);
  runtime.update(33);
  runtime.render(20);
  assert.equal(runtime.command('HELLO', ['world']), true);
  assert.deepEqual(
    events.map((event) => event.type),
    ['initialize', 'start', 'update', 'render', 'stop', 'render', 'command'],
  );
  assert.equal(events[2].deltaTime, 33);
  assert.equal(events[3].deltaTime, 16);
  assert.equal(events.at(-1)!.commandName, 'hello');
  game = null;
  runtime.suspend(); // Cleanup is allowed after detaching the game.
  assert.equal(events.at(-1)!.type, 'dispose');
  assert.equal(runtime.initialized, false);
  assert.equal(runtime.start(), false);
  assert.throws(() => buses[0].subscribe('start', () => {}), /disposed/);
  game = {};
  assert.equal(runtime.start(), true);
  assert.equal(buses.length, 2);
  runtime.suspend();
  assert.ok(releases >= 2);
});

test('initialize failure disposes its runtime, preserves the cause, and allows a clean retry', () => {
  const { commands } = registry();
  const errors: string[] = [];
  const sequence: string[] = [];
  let attempts = 0;
  class Script {
    constructor(bus: EventBus) {
      const attempt = ++attempts;
      bus.subscribe('initialize', () => {
        sequence.push('init');
        if (attempt === 1) throw new Error('init failed');
      });
      bus.subscribe('dispose', () => {
        sequence.push('dispose');
      });
    }
    getInfo() {
      return info;
    }
  }
  const runtime = new AutomationRuntime(
    'example',
    info,
    Script,
    commands,
    () => ({}),
    () => {},
    (type) => errors.push(type),
  );
  assert.equal(runtime.start(), false);
  assert.equal(runtime.lastError, 'init failed');
  assert.deepEqual(sequence, ['init', 'dispose']);
  assert.equal(runtime.running, false);
  assert.equal(runtime.start(), true);
  assert.equal(attempts, 2);
  assert.deepEqual(errors, ['initialize']);
  runtime.suspend();
});

test('runtime errors stop running scripts and suppress repeated stopped-render failures', () => {
  const { commands } = registry();
  const errors: string[] = [];
  let stops = 0,
    releases = 0,
    renderCalls = 0;
  class Script {
    constructor(bus: EventBus) {
      bus.renderWhileStopped = true;
      bus.subscribe('update', () => {
        throw new Error('tick failed');
      });
      bus.subscribe('stop', () => {
        stops++;
      });
      bus.subscribe('render', () => {
        renderCalls++;
        throw new Error('render failed');
      });
    }
    getInfo() {
      return info;
    }
  }
  const runtime = new AutomationRuntime(
    'example',
    info,
    Script,
    commands,
    () => ({}),
    () => {
      releases++;
    },
    (type) => errors.push(type),
  );
  runtime.start();
  runtime.update(33);
  runtime.update(33);
  assert.equal(runtime.running, false);
  assert.equal(stops, 1);
  assert.equal(releases, 1);
  assert.equal(runtime.lastError, 'tick failed');
  runtime.render(16);
  runtime.render(16);
  assert.equal(renderCalls, 1);
  assert.deepEqual(errors, ['update', 'render']);
  runtime.suspend();
});

test('room suspension releases controls even if command-registry cleanup fails', () => {
  const { commands } = registry();
  commands.unregisterOwner = () => {
    throw new Error('registry cleanup failed');
  };
  let releases = 0;
  class Script {
    getInfo() {
      return info;
    }
  }
  const runtime = new AutomationRuntime(
    'example',
    info,
    Script,
    commands,
    () => ({}),
    () => {
      releases++;
    },
    () => {},
  );
  runtime.start();
  assert.doesNotThrow(() => runtime.suspend());
  assert.equal(runtime.running, false);
  assert.equal(runtime.initialized, false);
  assert.equal(releases, 2);
});
