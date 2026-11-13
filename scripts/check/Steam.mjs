import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Run against the user's already-connected Electron game. Refresh is opt-in and
// uses Game.reload(), never page reload or chat/network message injection.
const refresh = process.argv.includes('--refresh');
const screens = process.argv.includes('--screens');
const initialization = process.argv.includes('--initialization');
assert.ok(
  !(initialization && (screens || refresh)),
  '--initialization is read-only; use the connected gate for screens or refresh',
);
const port = Number(process.env.QOLAF_CDP_PORT ?? 9228);
assert.ok(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid CDP port');
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find(
  (page) => page.type === 'page' && /^https:\/\/raony\.dev\/astroflux\//.test(page.url),
);
assert.ok(page, 'Open the Steam QoLAF game with remote debugging enabled');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let sequence = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
const snapshotExpression = `(() => {
  const game = window.QoLAF?.game;
  if (!game) return { ready: false };
  const stage = game.get_stage();
  return {
    ready: !!game.get_connected() && !!game.chatInput && !!game.hud?.radar && !!stage,
    initialized: !!game.chatInput && !!game.hud?.radar && !!stage,
    connected: !!game.get_connected(),
    state: game.gameStateMachine.currentState?.__class__?.__name__,
    chatBusy: game.chatInput.isActive() || !!game.chatInput.input.get_text().length,
    timeOrigin: performance.timeOrigin,
    bundles: performance.getEntriesByType('resource')
      .filter(entry => /\\/(qolaf-client|client)\\.js(?:[?#]|$)/.test(entry.name))
      .map(entry => ({ path: new URL(entry.name).pathname, start: entry.startTime })),
  };
})()`;
async function hostSnapshot() {
  const proto = await send('Runtime.evaluate', {
    expression: 'import("/astroflux/plugins/core.js").then(module => module.PluginHost.prototype)',
    awaitPromise: true,
    objectGroup: 'qolaf-audit',
  });
  const objects = await send('Runtime.queryObjects', {
    prototypeObjectId: proto.result.objectId,
    objectGroup: 'qolaf-audit',
  });
  const result = await send('Runtime.callFunctionOn', {
    objectId: objects.objects.objectId,
    functionDeclaration: `function() { return this.filter(host => !host.scope.closed).map(host => ({
      readyIsCurrent: !!host.game && host.readyGame === host.game,
      active: host.records.filter(record => record.state === 'active').length,
      clientActive: host.records.some(record => record.id === 'qolaf.client' && record.state === 'active'),
      errors: host.records.filter(record => record.error).map(record => record.error),
      diagnostics: host.diagnostics.filter(entry => entry.level === 'error').map(entry => entry.message),
    })); }`,
    returnByValue: true,
  });
  assert.ok(!result.exceptionDetails, 'Cannot inspect plugin lifecycle');
  await send('Runtime.releaseObjectGroup', { objectGroup: 'qolaf-audit' });
  return result.result.value;
}
try {
  const before = await evaluate(snapshotExpression);
  assert.equal(
    initialization ? before.initialized : before.ready,
    true,
    initialization ? 'Game scene must be initialized' : 'Game must be logged in and connected',
  );
  const bindingsSource = await readFile(
    new URL('../../src/game/Bindings.ts', import.meta.url),
    'utf8',
  );
  const requiredClasses = [
    ...new Set(
      [...bindingsSource.matchAll(/reflection\.require\('([^']+)'\)/g)].map((match) => match[1]),
    ),
  ];
  assert.ok(requiredClasses.length > 0, 'No required bindings found');
  const missingClasses = await evaluate(
    `(${JSON.stringify(requiredClasses)}).filter(name => !window.__AF_hx?.[name])`,
  );
  assert.deepEqual(missingClasses, [], 'Loaded Haxe game is missing required client bindings');
  if (refresh) {
    assert.equal(before.chatBusy, false, 'Refusing to refresh while chat has a draft or focus');
    assert.equal(
      before.state,
      'core.states.gameStates.RoamingState',
      'Close the current screen before refresh',
    );
    const changed = await evaluate(`(async () => {
      const previous = QoLAF.game;
      previous.reload();
      const deadline = performance.now() + 15000;
      while (performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const game = QoLAF.game;
        if (game && game !== previous && game.get_connected() && game.chatInput && game.hud?.radar) return true;
      }
      return false;
    })()`);
    assert.equal(changed, true, 'Room refresh did not produce a ready replacement Game');
  }
  let checkedScreens = [];
  if (screens) {
    checkedScreens = await evaluate(`(async () => {
      const game = QoLAF.game, classes = __AF_hx, chat = game.chatInput;
      if (chat.isActive() || chat.input.get_text().length ||
          game.gameStateMachine.currentState.__class__.__name__ !== 'core.states.gameStates.RoamingState')
        throw Error('Screen checks require idle gameplay and an empty chat draft');
      const settings = classes['core.scene.SceneBase'].clientSettings;
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const press = key => {
        for (const type of ['keydown', 'keyup'])
          window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
      };
      const results = [];
      for (const screen of ['settingsButton', 'mapButton', 'shipButton', 'cargoButton',
          'leaderboardButton', 'clanButton', 'artifactsClassic', 'artifactsExpanded']) {
        if (chat.isActive() || chat.input.get_text().length) throw Error('Chat became busy');
        const previousLayout = settings.expandedArtifactOverview;
        try {
          if (screen.startsWith('artifacts')) {
            settings.expandedArtifactOverview = screen === 'artifactsExpanded';
            try { game.hud.artifactsButton.clickCallback(); }
            finally { settings.expandedArtifactOverview = previousLayout; }
          } else game.hud[screen].clickCallback();
          await wait(300);
          const state = game.gameStateMachine.currentState;
          press('Enter');
          await wait(30);
          const expected = screen !== 'artifactsExpanded';
          const passed = chat.isActive() === expected &&
            (document.activeElement === chat.input.element) === expected &&
            game.messageLog.get_visible() === expected;
          press('Escape');
          const closed = !chat.isActive() && game.gameStateMachine.currentState === state;
          if (!passed || !closed) throw Error('Chat overlay mismatch: ' + screen);
          results.push(screen);
        } finally {
          settings.expandedArtifactOverview = previousLayout;
          // Never erase a draft typed by the user during a check.
          if (!chat.input.get_text().length) {
            chat.closeChat();
            game.enterState(new classes['core.states.gameStates.RoamingState'](game));
          }
        }
      }
      return results;
    })()`);
  }
  const after = await evaluate(snapshotExpression);
  assert.equal(initialization ? after.initialized : after.ready, true);
  assert.equal(after.timeOrigin, before.timeOrigin, 'Page unexpectedly reloaded');
  assert.deepEqual(after.bundles, before.bundles, 'Plugin bundle was fetched again');
  const hosts = await hostSnapshot();
  assert.equal(hosts.length, 1, 'Expected one live plugin host');
  assert.equal(hosts[0].readyIsCurrent, true, 'Host is attached to an old room');
  assert.equal(hosts[0].clientActive, true, 'QoLAF Client is not active');
  assert.deepEqual(hosts[0].errors, [], 'Plugin record errors');
  assert.deepEqual(hosts[0].diagnostics, [], 'Hook/initialization errors');
  console.log(
    JSON.stringify({
      passed: true,
      scope: initialization ? 'initialization-only' : 'connected-gameplay',
      connected: after.connected,
      checkedBindings: requiredClasses.length,
      refreshed: refresh,
      state: after.state,
      activePlugins: hosts[0].active,
      checkedScreens,
      pluginRequestsUnchanged: true,
    }),
  );
} finally {
  socket.close();
  for (const request of pending.values()) clearTimeout(request.timer);
}
