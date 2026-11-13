import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import type { ClanBrief } from '../src/game/ClanIdentity';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeClanLogos } from '../src/ui/NativeClanLogos';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('clan widgets own icons and tooltips, reject stale replies, and preserve cache on disposal', () => {
  class Node {
    children: Node[] = [];
    parent: Node | null = null;
    disposed = false;
    addChild(child: Node) {
      child.removeFromParent();
      this.children.push(child);
      child.parent = this;
    }
    removeFromParent(dispose = false) {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
      if (dispose) this.dispose();
    }
    dispose() {
      this.disposed = true;
      for (const child of [...this.children]) child.removeFromParent(true);
    }
    removeEventListener() {}
    get_stage() {
      return !this.disposed;
    }
  }
  class Icon extends Node {
    constructor(readonly texture: object) {
      super();
    }
    get_texture() {
      return this.texture;
    }
    set_scaleX() {}
    set_scaleY() {}
    set_color() {}
    set_touchable() {}
  }
  const tips: Tip[] = [];
  class Tip {
    disposed = false;
    constructor(_game: unknown, public target: object | null) {
      tips.push(this);
    }
    dispose() {
      assert.notEqual(this.target, null, 'native tooltip cannot be disposed twice');
      this.target = null;
      this.disposed = true;
    }
  }
  const player = () => ({
    id: 'p',
    clanId: 'c',
    clanName: '',
    clanRankName: '',
    clanLogoColor: 0,
    clanLogo: null as Icon | null,
    clanIdentityPlayerId: '',
    clanIdentityClanId: '',
  });
  class Logo extends Node {
    g = { get_isLeaving: () => false };
    results: Array<boolean | undefined> = [];
    callback: ((value?: boolean) => void) | null = (value) => this.results.push(value);
    constructor(readonly player = playerFactory()) {
      super();
    }
    init() {
      throw new Error('unpatched init');
    }
    dispose() {
      throw new Error('global clan tooltip disposal must not run');
    }
  }
  const playerFactory = player;
  const replies: Array<(clan: ClanBrief) => void> = [];
  const classes = {
    'core.clan.PlayerClanLogo': Logo,
    'core.clan.ClanClient': {
      brief: (_g: object, _c: string, _p: string, reply: (clan: ClanBrief) => void) =>
        replies.push(reply),
    },
    'starling.display.Sprite': Node,
    'starling.display.Image': Icon,
    'core.hud.components.ToolTip': Tip,
    'textures.TextureLocator': {
      getService: () => ({
        getTextureGUIByTextureName: (name: string) => {
          if (name === 'missing') throw new Error('missing texture');
          return { name };
        },
      }),
    },
  };
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => Reflect.get(classes, name) ?? {},
    around: (target: object, key: string, callback: Function) => {
      const off = hooks.add(target, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installNativeClanLogos(api);
  const clan = { name: 'Clan', rankName: 'Member', color: 123, logo: 'logo' };
  try {
    const first = new Logo();
    first.init();
    replies.shift()!(clan);
    const cached = first.player.clanLogo!;
    const second = new Logo(first.player);
    second.init();
    assert.equal(replies.length, 0);
    assert.equal(first.children.length, 1);
    assert.equal(second.children.length, 1);
    assert.notEqual(first.children[0], second.children[0]);
    assert.notEqual(first.children[0], cached);
    assert.equal(cached.parent, null);
    first.dispose();
    first.dispose();
    assert.equal(cached.disposed, false);
    assert.equal(tips[0].disposed, true);
    assert.equal(tips[1].disposed, false);
    const stale = new Logo();
    stale.init();
    stale.player.clanId = 'other';
    replies.shift()!(clan);
    assert.equal(stale.children.length, 0);
    assert.equal(stale.player.clanName, '');
    const removed = new Logo();
    removed.init();
    removed.dispose();
    replies.shift()!(clan);
    assert.equal(removed.children.length, 0);
    const missing = new Logo();
    missing.init();
    replies.shift()!({ ...clan, logo: 'missing' });
    assert.equal(missing.player.clanName, 'Clan');
    assert.equal(missing.player.clanLogo, null);
    assert.deepEqual(missing.results, [undefined]);
    const pending = new Logo();
    pending.init();
    tips[1].dispose(); // Native clan-page group cleanup precedes plugin unload.
    cleanups.reverse().forEach((off) => off());
    cleanups.length = 0;
    replies.shift()!(clan);
    assert.equal(pending.children.length, 0);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});
