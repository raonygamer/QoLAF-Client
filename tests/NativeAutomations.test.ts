import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error actual host hooks
import { Hooks } from './Fixtures/HostCore.js';
import {
  installNativeAutomations,
  reserveNativeCommands,
} from '../src/Automation/NativeAutomations';
import { ChatCommandRegistry } from '../src/Chat/ChatCommandRegistry';
import type { EventBus } from '../src/Automation/EventBus';
import type { AutomationEvent } from '../src/Automation/AutomationEvent';

test('native automation integration preserves chat routing, uses millisecond clocks and cleans up rooms', async () => {
  const calls: string[] = [],
    deltas: number[] = [];
  let actions = 0,
    savedReads = 0;
  class Game {
    static TICK_LENGTH = 33;
    static playerPerformedAction() {
      actions++;
    }
    tickUpdate() {
      calls.push('native tick');
    }
    disconnectIfInactive() {
      calls.push('idle check');
    }
  }
  class Chat {
    text = '';
    tabs = 0;
    input = {
      get_text: () => this.text,
      set_text: (value: string) => {
        this.text = value;
      },
    };
    constructor(public g: Game) {}
    parseCommand(text: string) {
      const space = text.indexOf(' ');
      return space < 0 ? [text.slice(1)] : [text.slice(1, space), text.slice(space + 1)];
    }
    updateTab() {
      this.tabs++;
    }
    sendMessage() {
      calls.push('native chat:' + this.text);
      return 'native result';
    }
  }
  class Script {
    static SCRIPT_ID = 'probe';
    constructor(bus: EventBus) {
      bus.subscribe('update', (event: AutomationEvent) => {
        calls.push('automation tick');
        deltas.push(event.deltaTime);
      });
      bus.subscribe('render', (event: AutomationEvent) => deltas.push(event.deltaTime));
      bus.subscribe('stop', () => {
        calls.push('stopped');
        calls.push('stop API:' + typeof classes['af.AutomationEvent']);
      });
      bus.registerCommand('probe:local', { description: 'Custom namespaced local' }, () =>
        calls.push('custom local'),
      );
      bus.registerCommand('probe:run', { description: 'Run' }, () => calls.push('custom run'));
    }
    getInfo() {
      return { name: 'Probe', description: '', version: '1', authors: [], min_client_version: 1 };
    }
  }
  const classes: any = { 'core.scene.Game': Game, 'core.hud.components.chat.ChatInputText': Chat };
  const hooks = new Hooks();
  const rootCleanups: Function[] = [],
    sessionCleanups: Function[] = [];
  const rootEvents = new Map<string, Function>(),
    sessionEvents = new Map<string, Function>();
  let onGame: Function;
  const makeAPI = (cleanups: Function[], events: Map<string, Function>): any => ({
    cls: (name: string) => classes[name],
    raw: { classes },
    storage: { get: (_key: string, fallback: unknown) => fallback, set() {} },
    defer: (fn: Function) => cleanups.push(fn),
    on: (name: string, fn: Function) => events.set(name, fn),
    onGame: (fn: Function) => {
      onGame = fn;
    },
    log() {},
    before: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'before', fn)),
    after: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'after', fn)),
    around: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
  });
  const manager = installNativeAutomations(makeAPI(rootCleanups, rootEvents), {
    storage: {
      path: '',
      read: () => {
        savedReads++;
        return [];
      },
      write() {},
    },
    loader: { fetch: async () => '', compile: async () => Script },
  });
  rootEvents.get('classesReady')!();
  assert.equal(savedReads, 0);
  assert.ok(classes['af.AutomationStopError']);
  const game = new Game();
  onGame!(game, makeAPI(sessionCleanups, sessionEvents));
  assert.equal(savedReads, 1);
  await manager.importCode('', '', 'Probe.js');
  manager.start('probe');
  game.tickUpdate();
  assert.deepEqual(calls.slice(-2), ['native tick', 'automation tick']);
  sessionEvents.get('frame')!({ game, event: { get_passedTime: () => 0.016 } });
  assert.deepEqual(deltas, [33, 16]);
  const chat = new Chat(game);
  chat.text = '/local hello';
  assert.equal(chat.sendMessage(), 'native result');
  chat.text = 'ordinary chat';
  assert.equal(chat.sendMessage(), 'native result');
  chat.text = '/unknown';
  assert.equal(chat.sendMessage(), 'native result');
  chat.text = '/probe:local';
  assert.equal(chat.sendMessage(), undefined);
  chat.text = '/run';
  chat.sendMessage();
  assert.deepEqual(calls.slice(-2), ['custom local', 'custom run']);
  assert.equal(chat.text, '');
  assert.equal(chat.tabs, 2);
  manager.setTransientDontKick('probe', true);
  game.disconnectIfInactive();
  assert.equal(actions, 2);
  sessionCleanups.reverse().forEach((cleanup) => cleanup());
  assert.equal((game as any).automationManager, undefined);
  assert.equal(manager.getModule('probe')!.running, false);
  assert.ok(calls.includes('stopped'));
  const nextSessionCleanups: Function[] = [];
  onGame!(new Game(), makeAPI(nextSessionCleanups, new Map()));
  manager.start('probe');
  calls.length = 0;
  rootCleanups.reverse().forEach((cleanup) => cleanup());
  assert.ok(
    calls.includes('stop API:function'),
    'module STOP runs before its APIs are uninstalled',
  );
  nextSessionCleanups.reverse().forEach((cleanup) => cleanup());
  assert.equal(classes['af.AutomationStopError'], undefined);
  chat.text = '/run';
  assert.equal(chat.sendMessage(), 'native result');
});

test('new native switch cases are reserved alongside the known vanilla commands', () => {
  const registry = new ChatCommandRegistry();
  reserveNativeCommands(registry, function () {
    switch ('upstream-new' as string) {
      case 'upstream-new':
        return;
    }
  });
  registry.registerCommand('plugin:upstream-new', { description: 'Custom' }, () =>
    assert.fail('must remain native'),
  );
  assert.equal(registry.dispatch('upstream-new').matched, false);
});
