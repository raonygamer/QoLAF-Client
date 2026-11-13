import assert from 'node:assert/strict';
import test from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses, type Player } from '../src/game/Bindings';
import { installNativeDeathMessages } from '../src/chat/NativeDeathMessages';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('death notes use native player getters, escape names and preserve native fallback', () => {
  const messages: Array<{ channel: string; text: string }> = [];
  const native: Array<{ victim: Player; killer: string | null; cause: string | null }> = [];
  const cleanups: Array<() => void> = [];
  class Scene {
    room = { id: 'room' };
    clock = { getServerTime: () => 123456 };
  }
  class Log {
    static writeDeathNote(victim: Player, killer: string | null, cause: string | null) {
      native.push({ victim, killer, cause });
    }
    static writeChatMsg(channel: string, text: string) {
      messages.push({ channel, text });
    }
  }
  const classes: Record<string, object> = {
    'core.hud.components.chat.MessageLog': Log,
    'core.scene.Game': Scene,
    'generics.Localize': { t: (text: string) => text },
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    game: new Scene(),
    cls: (name: string) => classes[name] ?? {},
    around: (target: object, key: string, callback: Function) => {
      const off = hooks.add(target, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installNativeDeathMessages(api);
  // Native Haxe player has a getter; a JS `name` property is not required.
  const victim = { id: 'victim', get_name: () => '<Pilot & "friend">' } as Player;
  try {
    Log.writeDeathNote(victim, 'Enemy <one>', 'Missile Launcher');
    assert.equal(messages.length, 1);
    assert.equal(messages[0].channel, 'death');
    assert.match(messages[0].text, /&lt;Pilot &amp; &quot;friend&quot;&gt;/);
    assert.match(messages[0].text, /Enemy &lt;one&gt;/);
    Log.writeDeathNote(victim, 'Enemy <one>', 'Missile Launcher');
    assert.equal(messages[1].text, messages[0].text);
    Log.writeDeathNote(victim, 'Enemy', 'New upstream weapon');
    assert.deepEqual(native, [{ victim, killer: 'Enemy', cause: 'New upstream weapon' }]);
    Log.writeDeathNote(victim, '', 'sun');
    assert.equal(messages.length, 3);
    assert.match(messages[2].text, /&lt;Pilot/);
    Log.writeDeathNote(victim, 'Naxar Wave Generator lvl 50', 'New upstream weapon');
    assert.match(messages[3].text, /Nexar/);
    assert.doesNotMatch(messages[3].text, /Naxar/);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  Log.writeDeathNote(victim, 'Enemy', 'Missile Launcher');
  assert.equal(native.length, 2);
});
