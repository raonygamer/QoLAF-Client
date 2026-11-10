import assert from 'node:assert/strict';
import { test } from 'node:test';
import { automationStatus, dispatchAutomationChat } from '../src/Chat/AutomationCommands';

test('legacy automation commands preserve status, whitespace parsing and original errors', () => {
  const messages: any[] = [],
    statuses: string[] = [],
    calls: any[] = [];
  let handles = true,
    dontKick = false;
  const game: any = {
    automationManager: {
      modules: [{ running: true, displayName: 'Example <one> & two' }],
      getModule: (id: string) => (id === 'example' ? {} : undefined),
      dispatchCommand: (...args: any[]) => {
        calls.push(args);
        return handles;
      },
    },
    toggleInactivityDisconnectPrevention: () => (dontKick = !dontKick),
  };
  const send = (parts: string[], current = game) =>
    dispatchAutomationChat(
      parts,
      current,
      (message, type) => messages.push([message, type]),
      (message) => statuses.push(message),
    );
  assert.equal(send(['local', 'hello']), false);
  assert.equal(send(['script']), true);
  assert.deepEqual(statuses, [
    "Running automation: <font color='#ff00bf'>Example &lt;one&gt; &amp; two</font>.",
  ]);
  game.automationManager.modules.push({ running: true, displayName: 'Second' });
  assert.match(automationStatus(game), /^Running automations:/);
  game.automationManager.modules.forEach((module: any) => (module.running = false));
  assert.equal(automationStatus(game), 'No automation running.');
  assert.equal(automationStatus(null), 'No automation running.');
  send(['automation', ' example Run "two words"  last ']);
  assert.deepEqual(
    calls,
    [['example', 'Run', ['"two', 'words"', 'last']]],
    'legacy commands deliberately split whitespace, unlike structured commands',
  );
  send(['script', '']);
  send(['script', 'example']);
  send(['script', 'missing run']);
  handles = false;
  send(['script', 'example run']);
  assert.deepEqual(messages.splice(0), [
    ['Usage: /script <automation-id> <command> [arguments]', 'error'],
    ['Usage: /script <automation-id> <command> [arguments]', 'error'],
    ["Automation 'missing' is not installed.", 'error'],
    ["Automation 'example' did not handle command 'run'.", 'error'],
  ]);
  send(['script', 'example run'], {});
  assert.deepEqual(messages.pop(), ['Automations are unavailable in this runtime.', 'error']);
  send(['dontkick']);
  assert.equal(dontKick, true);
  send(['dontkick']);
  assert.equal(dontKick, false);
  assert.deepEqual(
    messages.map((item) => item[0]),
    ['Persistent no-kick on inactivity enabled.', 'Persistent no-kick on inactivity disabled.'],
  );
});
