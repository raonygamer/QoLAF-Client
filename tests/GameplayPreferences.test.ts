import { bindGameClasses } from '../src/game/Bindings';
import { DeviceSettings } from '../src/settings/DeviceSettings';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installRespawn } from '../src/runtime/Respawn';
import { installDamageText } from '../src/hud/DamageText';

function fixture() {
  const settings = { disableSpaceToRespawn: false, formatDamageText: true };
  const hooks: Record<string, Function> = {};
  const api: any = {
    cls: (name: string) =>
      name === 'core.scene.SceneBase'
        ? { settings }
        : { prototype: { updateInput() {}, execute() {}, createDmgText() {} } },
    around: (_target: unknown, name: string, callback: Function) => {
      hooks[name] = callback;
    },
    after: (_target: unknown, name: string, callback: Function) => {
      hooks[name] = callback;
    },
  };
  return { settings, hooks, api };
}

test('respawn respects readiness, manual Space, and current PvP/survival prompts', () => {
  const { settings, hooks, api } = fixture();
  let sends = 0;
  let nativeCalls = 0;
  let space = false;
  let ready = true;
  const game: any = {
    time: 10000,
    send: (name: string) => {
      assert.equal(name, 'respawn');
      sends++;
    },
    solarSystem: { isPvpSystemInEditor: false },
    isSystemTypeSurvival: () => true,
    hud: { uberStats: { getMyLives: () => 0 } },
  };
  const me = {
    get_commandable() {
      return this.commandable;
    },
    commandable: false,
    respawnNextReady: 10500,
    isMe: true,
    respawnReady: () => ready,
  };
  const state: any = {
    g: game,
    me,
    player: me,
    input: { isKeyPressed: () => space },
    respawnText: {
      text: '',
      set_text(value: string) {
        this.text = value;
      },
      get_format: () => ({ set_size() {} }),
      alignPivot() {},
    },
  };
  bindGameClasses(api);
  const preferences = new DeviceSettings({ get: (_key, fallback) => fallback, set() {} });
  preferences.set('disableSpaceToRespawn', false);
  installRespawn(api, game, preferences);
  const update = () =>
    hooks.updateInput.call(state, () => {
      nativeCalls++;
      if (!me.commandable && ready && space) {
        me.respawnNextReady = 0;
        game.send('respawn');
      }
    });
  update();
  assert.equal(sends, 0);
  space = true;
  update();
  assert.equal(sends, 1);
  assert.equal(me.respawnNextReady, 0);
  space = false;
  preferences.set('disableSpaceToRespawn', true);
  ready = false;
  update();
  assert.equal(sends, 1);
  ready = true;
  update();
  assert.equal(sends, 2);
  me.commandable = true;
  update();
  assert.equal(nativeCalls, 3);
  hooks.execute.call(state);
  assert.equal(state.respawnText.text, 'Leaving...');
  game.solarSystem.isPvpSystemInEditor = true;
  state.respawnText.text = '';
  hooks.execute.call(state);
  assert.equal(state.respawnText.text, '');
});

test('damage presentation formats native totals without altering particle ownership, scale, or timing', () => {
  const { settings, hooks, api } = fixture();
  const game = {};
  installDamageText(api, game);
  const particle = {
    text: '12500',
    ttl: 1000,
    baseScale: 1.5,
    owner: {},
    set_text(value: string) {
      this.text = value;
    },
  };
  const unit = { lastDmg: 12500, lastHeal: 2000, lastDmgText: particle, lastHealText: particle };
  const original = { ...particle };
  hooks.createDmgText.call({ g: game }, undefined, 500, unit);
  assert.equal(particle.text, '12.5k');
  hooks.createDmgText.call({ g: game }, undefined, -2000, unit);
  assert.equal(particle.text, '2k');
  settings.formatDamageText = false;
  hooks.createDmgText.call({ g: game }, undefined, 500, unit);
  assert.equal(particle.text, '12500');
  assert.equal(particle.ttl, original.ttl);
  assert.equal(particle.baseScale, original.baseScale);
  assert.equal(particle.owner, original.owner);
  assert.equal(unit.lastDmg, 12500);
});
