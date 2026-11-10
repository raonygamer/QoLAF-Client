import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatCommandRegistry } from '../src/chat/ChatCommandRegistry';
import { ChatCommandInvocation } from '../src/chat/ChatCommandInvocation';
import { AutomationManager } from '../src/automation/AutomationManager';
import { AutomationInfo } from '../src/automation/AutomationInfo';
import { EventBus } from '../src/automation/EventBus';
import { AutomationStopError } from '../src/automation/AutomationStopError';

test('oldest surviving bare-name registration wins while native commands remain reserved', () => {
  const registry = new ChatCommandRegistry(),
    called: string[] = [];
  const first = () => {
      called.push('first');
    },
    second = () => {
      called.push('second');
    };
  registry.registerCommand(' A:Go ', { description: 'First' }, first);
  registry.registerCommand('b:go', { summary: 'Second' }, second);
  assert.equal(registry.dispatch('go').handled, true);
  assert.deepEqual(called, ['first']);
  assert.equal(registry.ownsBareName('a:go'), true);
  assert.equal(registry.unregisterCommand('a:go', second), false);
  registry.unregisterCommand('a:go', first);
  registry.dispatch('GO');
  assert.deepEqual(called, ['first', 'second']);
  registry.reserveBuiltInCommands(['GO']);
  assert.equal(registry.dispatch('go').matched, false);
  assert.equal(registry.dispatch('b:go').handled, true);
  assert.equal(registry.ownsBareName('b:go'), false);
});

test('argument descriptors retain source validation, quoted values, defaults, extras and usage errors', () => {
  const registry = new ChatCommandRegistry();
  let invocation: ChatCommandInvocation | undefined;
  registry.registerCommand(
    'example:run',
    {
      description: 'Run task',
      required: ['target'],
      optional: [{ name: 'mode', defaultValue: 'safe' }],
      allowExtraArguments: true,
    },
    (value: ChatCommandInvocation) => {
      invocation = value;
    },
  );
  assert.equal(registry.dispatch('run', '"target name"').handled, true);
  assert.deepEqual(invocation!.arguments, ['target name']);
  assert.equal(invocation!.getArgument('MODE'), 'safe');
  assert.equal(invocation!.hasArgument('absent'), false);
  registry.dispatch('run', 'ship fast "extra one" two');
  assert.deepEqual(invocation!.extraArguments, ['extra one', 'two']);
  invocation!.arguments.push('mutation');
  invocation!.namedArguments.target = 'mutated';
  assert.equal(invocation!.getArgument('target'), 'ship');
  assert.deepEqual(invocation!.arguments, ['ship', 'fast', 'extra one', 'two']);
  const missing = registry.dispatch('run', '');
  assert.equal(missing.status, 'argument_error');
  assert.equal(
    missing.message,
    "Missing required argument 'target'. Usage: /example:run <target> [mode=safe] [...]",
  );
  assert.equal(registry.dispatch('run', '"unfinished').status, 'parse_error');
  registry.registerCommand('example:stop', { description: 'Stop', usage: 'now' }, () => {});
  assert.equal(
    registry.dispatch('stop', 'extra').message,
    'Too many arguments. Usage: /example:stop now',
  );
  assert.throws(
    () => registry.registerCommand('bad name:go', { description: 'x' }, () => {}),
    /namespace/,
  );
  assert.throws(() => registry.registerCommand('x:y', {}, () => {}), /description/);
  assert.throws(
    () =>
      registry.registerCommand(
        'x:y',
        { description: 'x', mandatory: ['name'], optional: ['NAME'] },
        () => {},
      ),
    /Duplicate/,
  );
  assert.throws(
    () =>
      registry.registerCommand(
        'x:y',
        { description: 'x', mandatory: [{ name: 'name', defaultValue: 'x' }] },
        () => {},
      ),
    /cannot have a default/,
  );
});

test('help entries are sorted defensive snapshots and callback arity/error results match source', () => {
  const registry = new ChatCommandRegistry();
  registry.registerCommand('z:go', { description: 'Z', mandatory: ['x'] }, () => {});
  registry.registerCommand('a:go', { description: 'A' }, function () {
    assert.equal(arguments.length, 0);
  });
  const help = registry.getHelpEntries();
  assert.deepEqual(
    help.map((item) => [item.fullName, item.ownsBareName]),
    [
      ['a:go', false],
      ['z:go', true],
    ],
  );
  help[1].mandatory.splice(0);
  assert.equal(registry.getHelpEntries()[1].mandatory.length, 1);
  assert.equal(registry.dispatch('a:go').handled, true);
  registry.registerCommand('x:error', { description: 'Error' }, () => {
    throw new Error('failure');
  });
  assert.equal(registry.dispatch('error').status, 'handler_error');
  assert.equal(registry.dispatch('error').message, 'failure');
  assert.equal(registry.unregisterNamespace('z'), 1);
  assert.equal(registry.ownsBareName('a:go'), true);
});

test('automation commands are bound to the current game/bus and expected stops release controls', async () => {
  const registry = new ChatCommandRegistry();
  const buses: EventBus[] = [];
  let calls = 0,
    stops = 0;
  class Script {
    static SCRIPT_ID = 'example';
    constructor(bus: EventBus) {
      buses.push(bus);
      bus.registerCommand('example:go', { description: 'Go', mandatory: ['target'] }, () => {
        calls++;
      });
      bus.registerCommand('example:stop', { description: 'Expected stop' }, () => {
        throw new AutomationStopError('done');
      });
      bus.subscribe('stop', () => {
        stops++;
      });
    }
    getInfo() {
      return new AutomationInfo('Example', '', '1', [], 1);
    }
  }
  const manager = new AutomationManager(
    { path: '', read: () => [], write() {} },
    { fetch: async () => '', compile: async () => Script },
    registry,
    1,
    () => {},
    () => {},
  );
  const game = { automationManager: manager };
  await manager.importCode('', '', 'Example.js');
  // A known command is consumed before exposing parsing errors or calling its handler.
  assert.equal(registry.dispatch('go', '"unfinished', game).status, 'handled');
  assert.equal(calls, 0);
  manager.attachGame(game);
  assert.equal(registry.dispatch('go', 'ship', game).handled, true);
  assert.equal(calls, 1); // Commands also work while stopped, as in source.
  manager.start('example');
  manager.claimControls('example');
  manager.setTransientDontKick('example', true);
  assert.equal(registry.dispatch('stop', '', game).handled, true);
  assert.equal(manager.getModule('example')!.running, false);
  assert.equal(manager.getModule('example')!.lastError, 'done');
  assert.equal(manager.controlsClaimed, false);
  assert.equal(manager.transientDontKickActive, false);
  assert.equal(stops, 1);
  const oldBus = buses[0];
  manager.suspendForRoomTransition(game);
  const nextGame = { automationManager: manager };
  manager.attachGame(nextGame);
  assert.equal(manager.canDispatchOwnedCommand(oldBus, nextGame), false);
  assert.equal(manager.canDispatchOwnedCommand(buses[1], game), false);
  assert.equal(registry.dispatch('go', '"unfinished', game).status, 'handled');
  assert.equal(calls, 1);
  registry.dispatch('go', 'ship', nextGame);
  assert.equal(calls, 2);
  manager.dispose();
  assert.equal(registry.dispatch('example:go', 'ship', nextGame).matched, false);
});
