import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AutomationManager } from '../src/Automation/AutomationManager';
import { AutomationInfo } from '../src/Automation/AutomationInfo';
import { EventBus, type AutomationCommands } from '../src/Automation/EventBus';
import {
  BrowserAutomationStorage,
  type StoredAutomation,
} from '../src/Automation/AutomationStorage';

function fixture() {
  let records: StoredAutomation[] = [],
    failWrite = false,
    actions = 0;
  const errors: string[] = [],
    events: string[] = [],
    cleaned: string[] = [];
  const types = new Map<string, unknown>();
  const commands: AutomationCommands = {
    registerOwnedCommand: (_owner, name) => name,
    unregisterOwnedCommand: () => true,
    unregisterOwner: (owner) => {
      cleaned.push(owner.scriptId);
    },
    unregisterNamespace() {},
  };
  const storage = {
    path: 'test',
    read: () => records.map((record) => ({ ...record })),
    write: (value: readonly StoredAutomation[]) => {
      if (failWrite) throw new Error('storage full');
      records = value.map((record) => ({ ...record }));
    },
  };
  const loader = {
    fetch: async (url: string) => url,
    compile: async (code: string) => types.get(code),
  };
  const manager = new AutomationManager(
    storage,
    loader,
    commands,
    2,
    (id, phase) => errors.push(`${id}:${phase}`),
    () => {
      actions++;
    },
  );
  function module(id: string, min = 1, failTick = false) {
    class Script {
      static SCRIPT_ID = id;
      constructor(bus: EventBus) {
        events.push(`${id}:constructor`);
        for (const type of ['initialize', 'start', 'stop', 'dispose'])
          bus.subscribe(type, () => events.push(`${id}:${type}`));
        bus.subscribe('update', () => {
          if (failTick) throw new Error('tick failed');
        });
      }
      getInfo() {
        return new AutomationInfo(id, '', '1', [], min);
      }
    }
    types.set(id, Script);
    return Script;
  }
  return {
    manager,
    storage,
    types,
    module,
    events,
    errors,
    cleaned,
    actions: () => actions,
    failWrites: (value: boolean) => {
      failWrite = value;
    },
  };
}

test('automation import persists installed bytes, reuses its inspected instance, and never auto-starts', async () => {
  const f = fixture();
  f.module('example');
  f.manager.attachGame({});
  const module = await f.manager.importCode('example', 'file', 'Example.js');
  assert.equal(module.id, 'example');
  assert.equal(module.listDisplayName, 'example\n(example)');
  assert.equal(module.running, false);
  assert.equal(module.initialized, true);
  assert.deepEqual(f.events, ['example:constructor', 'example:initialize']);
  assert.deepEqual(f.storage.read(), [
    { id: 'example', code: 'example', source: 'file', fileName: 'Example.js' },
  ]);
  f.manager.modules.pop();
  assert.equal(f.manager.modules.length, 1);
  assert.equal(f.manager.start('example'), true);
  assert.equal(f.events.filter((event) => event.endsWith(':constructor')).length, 1);
  await assert.rejects(f.manager.importCode('example', 'file', 'Duplicate.js'), /already imported/);
  f.manager.dispose();
});

test('control and temporary inactivity ownership release on stop, failure and room change', async () => {
  const f = fixture();
  f.module('a');
  f.module('b', 1, true);
  const game = {};
  f.manager.attachGame(game);
  await f.manager.importCode('a', 'file', 'A.js');
  await f.manager.importCode('b', 'file', 'B.js');
  assert.equal(f.manager.claimControls('a'), false);
  f.manager.start('a');
  f.manager.start('b');
  assert.equal(f.manager.claimControls('a'), true);
  assert.equal(f.manager.claimControls('b'), false);
  assert.equal(f.manager.setTransientDontKick('a', true), true);
  assert.equal(f.manager.transientDontKickActive, true);
  assert.equal(f.actions(), 1);
  f.manager.stop('a');
  assert.equal(f.manager.controlsClaimed, false);
  assert.equal(f.manager.transientDontKickActive, false);
  assert.equal(f.manager.claimControls('b'), true);
  f.manager.setTransientDontKick('b', true);
  f.manager.update(33);
  assert.equal(f.manager.controlsClaimed, false);
  assert.equal(f.manager.transientDontKickActive, false);
  assert.equal(f.manager.getModule('b')!.lastError, 'tick failed');
  f.manager.start('a');
  f.manager.claimControls('a');
  f.manager.suspendForRoomTransition({}); // unrelated stale owner
  assert.equal(f.manager.ownsControls('a'), true);
  f.manager.suspendForRoomTransition(game);
  assert.equal(f.manager.start('a'), false);
  assert.equal(f.manager.getModule('a')!.initialized, false);
  f.manager.attachGame({});
  assert.equal(f.manager.getModule('a')!.initialized, true);
  assert.equal(f.manager.getModule('a')!.running, false);
  assert.equal(f.events.filter((event) => event === 'a:constructor').length, 2);
  f.manager.dispose();
});

test('failed validation or persistence disposes the inspected runtime without installing it', async () => {
  const f = fixture();
  f.module('future', 9);
  f.module('good');
  await assert.rejects(
    f.manager.importCode('future', '', 'Future.js'),
    /requires client version 9/,
  );
  assert.deepEqual(f.cleaned, ['future']);
  f.failWrites(true);
  await assert.rejects(f.manager.importCode('good', '', 'Good.js'), /storage full/);
  assert.deepEqual(f.cleaned, ['future', 'good']);
  assert.equal(f.manager.modules.length, 0);
  assert.deepEqual(f.storage.read(), []);
  f.failWrites(false);
  await f.manager.importCode('good', '', 'Good.js');
  assert.equal(f.manager.modules.length, 1);
  f.manager.dispose();
});

test('storage deletion failure keeps the installed module recoverable and reports no false removal', async () => {
  const f = fixture();
  f.module('a');
  f.manager.attachGame({});
  await f.manager.importCode('a', '', 'A.js');
  f.manager.start('a');
  f.failWrites(true);
  assert.throws(() => f.manager.remove('a'), /storage full/);
  assert.equal(f.manager.modules.length, 1);
  assert.equal(f.manager.getModule('a')!.running, false);
  assert.equal(f.manager.start('a'), true);
  f.failWrites(false);
  assert.equal(f.manager.remove('a'), true);
  assert.equal(f.manager.getModule('a'), undefined);
  assert.deepEqual(f.storage.read(), []);
  f.manager.dispose();
});

test('restore reads installed code, isolates bad modules and listener errors, and does not auto-run', async () => {
  const f = fixture();
  f.module('a');
  f.storage.write([
    { id: 'bad', code: 'missing', source: '', fileName: 'Bad.js' },
    { id: 'a', code: 'a', source: '', fileName: 'A.js' },
  ]);
  f.manager.addEventListener(AutomationManager.CHANGED, () => {
    throw new Error('UI failed');
  });
  await f.manager.restore();
  assert.equal(f.manager.modules.length, 1);
  assert.deepEqual(f.errors, ['bad:load', ':settings listener']);
  f.manager.attachGame({});
  assert.equal(f.manager.getModule('a')!.initialized, true);
  assert.equal(f.manager.getModule('a')!.running, false);
  f.manager.dispose();
});

test('an import completing after manager disposal cannot install or persist its module', async () => {
  const f = fixture();
  f.module('a');
  const pending = f.manager.importCode('a', '', 'A.js');
  f.manager.dispose();
  await assert.rejects(pending, /no longer available/);
  assert.equal(f.manager.modules.length, 0);
  assert.deepEqual(f.storage.read(), []);
  assert.deepEqual(f.events, []);
});

test('browser storage retains defensive snapshots and rejects malformed data', () => {
  let value: unknown = [];
  const storage = new BrowserAutomationStorage({
    get: <T>() => value as T,
    set: (_key, next) => {
      value = next;
    },
  });
  const original = { id: 'a', source: 'https://example.test/A.js', fileName: 'A.js', code: 'code' };
  storage.write([original]);
  original.code = 'changed';
  const first = storage.read();
  first[0].code = 'also changed';
  assert.equal(storage.read()[0].code, 'code');
  value = [{ id: 'broken' }];
  assert.throws(() => storage.read(), /Invalid stored automation/);
});

test('separately bundled modules may return plain metadata without importing host classes', async () => {
  const f = fixture();
  f.types.set(
    'plain',
    class {
      static SCRIPT_ID = 'plain';
      getInfo() {
        return {
          name: 'Plain',
          description: 'Standalone module',
          version: '1',
          authors: ['Author'],
          min_client_version: 1,
        };
      }
    },
  );
  const module = await f.manager.importCode('plain', 'file', 'Plain.js');
  assert.equal(module.info.name, 'Plain');
  assert.deepEqual(module.info.authors, ['Author']);
  assert.equal(module.info.minClientVersion, 1);
  f.manager.dispose();
});
