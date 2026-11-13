import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameScene } from '../src/game/Bindings';
import {
  boundActivityText,
  bossVitals,
  snapshotDiscordActivity,
} from '../src/discord/DiscordActivity';

test('activity byte limit preserves Unicode and removes controls and lone surrogates', () => {
  assert.equal(boundActivityText('a\n\tb\ud800'), 'a  b?');
  assert.equal(boundActivityText('x'.repeat(126) + '🚀'), 'x'.repeat(126));
  assert.equal(boundActivityText('🚀'.repeat(40)), '🚀'.repeat(32));
  assert.equal(new TextEncoder().encode(boundActivityText('é'.repeat(100))).length, 128);
});

test('boss vitals retain destroyed essential maxima and exclude decorative parts', () => {
  const part = (alive: boolean, essential = true) => ({
    alive,
    essential,
    hp: 500,
    shieldHp: 100,
    get_hpMax: () => 1000,
    get_shieldHpMax: () => 200,
  });
  assert.equal(
    bossVitals([part(true), part(false), part(true, false)]),
    'HP 500/2.0k (25%) | SH 100/400 (25%)',
  );
  assert.equal(bossVitals([]), 'Boss nearby');
});

test('activity follows menu, dock, death, warp and nearby boss precedence without exposing IDs', () => {
  const player = {
    isLanded: false,
    get_name: () => '  Test   Pilot ',
    get_level: () => 80,
    get_isWarpJumping: () => false,
    ship: { alive: true, get_pos: () => ({ x: 0, y: 0 }) },
  };
  const boss = {
    alive: true,
    isHostile: true,
    awaitingActivation: false,
    bossRadius: 100,
    get_name: () => 'Test Boss',
    get_pos: () => ({ x: 1050, y: 0 }),
    allComponents: [],
  };
  const state = {
    get_connected: () => true,
    get_isLeaving: () => false,
    get_me: () => player,
    solarSystem: { name: 'Test System', key: 'private-system-key' },
    room: { data: { systemType: 'clan' } },
    bossManager: { bosses: [boss] },
  };
  const game = state as unknown as GameScene;
  assert.equal(snapshotDiscordActivity(null).details, 'In the menus');
  const activity = () => snapshotDiscordActivity(game);
  assert.equal(activity().details, 'Fighting Test Boss | Test System (Clan Instance)');
  boss.awaitingActivation = true;
  assert.deepEqual(activity(), {
    details: 'Logged as Test Pilot (lvl 80)',
    state: 'Exploring Test System (Clan Instance)',
  });
  boss.awaitingActivation = false;
  boss.get_name = () => 'Three Emperors';
  assert.match(activity().state, /^Exploring/);
  boss.get_name = () => 'Test Boss';
  player.isLanded = true;
  assert.match(activity().state, /^Docked/);
  player.isLanded = false;
  player.ship.alive = false;
  assert.match(activity().state, /^Defeated/);
  player.ship.alive = true;
  player.get_isWarpJumping = () => true;
  assert.match(activity().state, /^Travelling/);
  assert.doesNotMatch(JSON.stringify(activity()), /private-system-key/);
  state.get_connected = () => false;
  assert.equal(activity().details, 'In the menus');
});

test('Emperor presence uses owned observations and leaves unseen hulls unknown', async () => {
  const { EmperorReadyNotifier } = await import('../src/ipc/EmperorReadyNotifier');
  const previous = EmperorReadyNotifier.instance;
  const game = {
    get_connected: () => true,
    get_isLeaving: () => false,
    get_me: () => ({
      isLanded: false,
      get_isWarpJumping: () => false,
      ship: { alive: true, get_pos: () => ({ x: 4000, y: 0 }) },
    }),
    solarSystem: { key: 'BC26CB28-5F73-BE5D-88EC-1D3F2676306D', name: 'Argon' },
    room: { data: { systemType: 'hostile' } },
    shipManager: { enemies: [] },
  } as unknown as GameScene;
  EmperorReadyNotifier.instance = {
    owns: (candidate: GameScene) => candidate === game,
    status: (name: string) => ({
      known: name !== 'Emperor Zharix',
      reconstructing: name === 'Emperor Yhgvis',
      ready: true,
      hp: 3000000,
    }),
  } as unknown as InstanceType<typeof EmperorReadyNotifier>;
  try {
    assert.deepEqual(snapshotDiscordActivity(game), {
      details: 'Fighting the Three Emperors | Argon (Hostile)',
      state: 'Xhersix: Ready (3.0M HP) | Yhgvis: Reconstructing | Zharix: Unknown',
    });
  } finally {
    EmperorReadyNotifier.instance = previous;
  }
});
