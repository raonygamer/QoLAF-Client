import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DiscordPresence, type DiscordBridge } from '../src/discord/DiscordPresence';

test('presence sends changed snapshots at five-second cadence, retains session timestamp and respects opt-out', async () => {
  let now = 0,
    starts = 0,
    stops = 0;
  const sent: Parameters<DiscordBridge['setActivity']>[0][] = [];
  let details = 'Exploring';
  const settings = { discordPresenceEnabled: true, discordPresenceApplicationId: '' };
  const bridge: DiscordBridge = {
    start: async () => {
      starts++;
      return { state: 'connected' };
    },
    status: async () => ({ state: 'active' }),
    stop: async () => {
      stops++;
      return { state: 'disabled' };
    },
    setActivity: async (activity) => {
      sent.push(activity);
      return { state: 'active' };
    },
  };
  const presence = new DiscordPresence(
    bridge,
    () => settings,
    () => ({ details, state: 'System' }),
    () => now,
  );
  await presence.tick();
  assert.equal(starts, 1);
  assert.equal(sent.length, 1);
  details = 'Docked';
  now = 4999;
  await presence.tick();
  assert.equal(sent.length, 1);
  now = 5000;
  await presence.tick();
  assert.equal(sent.length, 2);
  assert.equal(sent[0].timestamps.start, sent[1].timestamps.start);
  now = 10000;
  await presence.tick();
  assert.equal(sent.length, 2, 'unchanged data is not resent');
  settings.discordPresenceEnabled = false;
  await presence.tick();
  assert.equal(stops, 1);
  assert.equal(presence.statusText, 'Disabled');
  settings.discordPresenceEnabled = true;
  await presence.tick();
  assert.equal(starts, 2);
  presence.dispose();
  assert.equal(stops, 2);
});

test('in-flight startup cannot publish after opt-out and concurrent ticks do not spawn extra helpers', async () => {
  let resolve!: (status: { state: string }) => void,
    starts = 0,
    sent = 0,
    stops = 0;
  const settings = { discordPresenceEnabled: true, discordPresenceApplicationId: '' };
  const bridge: DiscordBridge = {
    start: () => {
      starts++;
      return new Promise((done) => {
        resolve = done;
      });
    },
    status: async () => ({ state: 'active' }),
    stop: async () => {
      stops++;
      return { state: 'disabled' };
    },
    setActivity: async () => {
      sent++;
      return { state: 'active' };
    },
  };
  const presence = new DiscordPresence(
    bridge,
    () => settings,
    () => ({ details: 'a', state: 'b' }),
  );
  const first = presence.tick();
  await presence.tick();
  assert.equal(starts, 1);
  settings.discordPresenceEnabled = false;
  resolve({ state: 'connected' });
  await first;
  assert.equal(sent, 0);
  await presence.tick();
  assert.equal(stops, 1);
  presence.dispose();
});

test('failed helpers stop after three attempts and explicit retry resets the limit', async () => {
  let now = 0,
    attempts = 0;
  const bridge: DiscordBridge = {
    start: async () => {
      attempts++;
      return { state: 'helper_failed' };
    },
    status: async () => ({ state: 'helper_failed' }),
    stop: async () => ({ state: 'disabled' }),
    setActivity: async () => assert.fail('failed helper received activity'),
  };
  const presence = new DiscordPresence(
    bridge,
    () => ({ discordPresenceEnabled: true, discordPresenceApplicationId: '' }),
    () => ({ details: '', state: '' }),
    () => now,
  );
  for (let i = 0; i < 5; i++) {
    now += 30000;
    await presence.tick();
  }
  assert.equal(attempts, 3);
  presence.reset();
  await presence.tick();
  assert.equal(attempts, 4);
  presence.dispose();
});
