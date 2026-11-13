import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installClanMemberCopy } from '../src/clan/ClanMemberCopy';
import { Display, Quad } from './fixtures/NativeGame';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('clan rows copy persistent IDs independently of management rights and restore on unload', async () => {
  class Image extends Display {
    constructor() {
      super();
      this.set_width(160);
      this.set_height(80);
      this.set_scaleX(0.5);
      this.set_scaleY(0.5);
    }
  }
  class Button extends Display {
    autoEnableAfterClick = false;
    enabled = true;
    constructor(
      readonly callback: () => void,
      public text: string,
    ) {
      super();
    }
    set_text(text: string) {
      this.text = text;
    }
    set_enabled(enabled: boolean) {
      this.enabled = enabled;
    }
  }
  class Clan {
    scrollContainer = new Display();
    valid = true;
    drawClanMember(_member: { player: string | null }, index: number, _clan: object) {
      if (!this.valid) return;
      const row = new Display();
      row.set_y(index * 60);
      row.addChild(new Quad(620, 56, 0));
      row.addChild(new Image());
      // Native returns early for ordinary members after adding the row.
      this.scrollContainer.addChild(row);
    }
  }
  const messages: string[] = [];
  const copies: string[] = [];
  let reject = false;
  let resolveCopy: (() => void) | null = null;
  let deferCopy = false;
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async writeText(text: string) {
          copies.push(text);
          if (reject) throw Error('denied');
          if (deferCopy)
            await new Promise<void>((resolve) => {
              resolveCopy = resolve;
            });
        },
      },
    },
  });
  const classes: Record<string, unknown> = {
    'core.states.gameStates.ClanState': Clan,
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
    'starling.display.Image': Image,
    'core.hud.components.Button': Button,
    'core.hud.components.chat.MessageLog': { write: (text: string) => messages.push(text) },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'around', callback);
      cleanup.push(off);
      return off;
    },
    before(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'before', callback);
      cleanup.push(off);
      return off;
    },
    defer: (off: () => void) => cleanup.push(off),
  } as unknown as API;
  bindGameClasses(api);
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  try {
    installClanMemberCopy(api);
    const clan = new Clan();
    const member = { player: 'persistent-id' };
    clan.drawClanMember(member, 2, {});
    member.player = 'changed-record';
    const row = clan.scrollContainer.getChildAt(0);
    const background = row.getChildAt(0);
    const image = row.getChildAt(1);
    const button = row.getChildAt(2) as Button;
    assert.equal(row.get_y(), 160);
    assert.equal(background.get_height(), 76);
    assert.equal(image.get_width(), 40);
    assert.equal(button.get_x(), 43);
    assert.equal(button.get_y(), 52);
    assert.equal(button.get_width(), 74);
    assert.equal(button.get_height(), 22);
    button.callback();
    await flush();
    assert.deepEqual(copies, ['persistent-id']);
    assert.equal(button.text, 'Copied');
    reject = true;
    button.callback();
    await flush();
    assert.equal(button.text, 'Retry');
    assert.equal(messages.length, 1);
    assert.match(messages[0], /persistent-id/);
    clan.drawClanMember({ player: null }, 3, {});
    const empty = clan.scrollContainer.getChildAt(1).getChildAt(2) as Button;
    assert.equal(empty.enabled, false);
    empty.callback();
    await flush();
    assert.equal(copies.length, 2);
    clan.valid = false;
    clan.drawClanMember(member, 4, {});
    assert.equal(clan.scrollContainer.get_numChildren(), 2);
    reject = false;
    deferCopy = true;
    button.callback();
    button.callback();
    assert.equal(copies.length, 3, 'concurrent clicks do not race clipboard writes');
    cleanup.reverse().forEach((off) => off());
    cleanup.length = 0;
    resolveCopy!();
    await flush();
    assert.equal(button.text, 'Retry', 'late clipboard completion ignores unloaded UI');
    assert.equal(row.get_y(), 120);
    assert.equal(background.get_height(), 56);
    assert.equal(image.get_scaleX(), 0.5);
    assert.equal(row.get_numChildren(), 2);
    assert.equal(button.disposed, true);
  } finally {
    cleanup.reverse().forEach((off) => off());
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
