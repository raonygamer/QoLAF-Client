import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installDeathPresentation } from '../src/runtime/DeathPresentation';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('death fields select original font sizes and switch countdown atlas without repeated layout work', () => {
  class Format {
    font = 'DAIDRR';
    constructor(public size: number) {}
    get_size() {
      return this.size;
    }
    set_size(value: number) {
      this.size = value;
    }
    get_font() {
      return this.font;
    }
    set_font(value: string) {
      this.font = value;
    }
  }
  class Text {
    format: Format;
    pivots = 0;
    constructor(size: number) {
      this.format = new Format(size);
    }
    get_format() {
      return this.format;
    }
    alignPivot() {
      this.pivots++;
    }
  }
  class Killed {
    player = { isMe: true };
    deathInfo = new Text(12);
    experience = new Text(12);
    respawnText = new Text(52);
    uberText = new Text(52);
    children = [this.deathInfo, {}, this.experience, this.respawnText, this.uberText];
    box = {
      get_numChildren: () => this.children.length,
      getChildAt: (i: number) => this.children[i],
    };
    ready = false;
    enter() {}
    execute() {
      if (this.ready) this.respawnText.format.set_size(20);
    }
  }
  const hooks = new Hooks(),
    cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) =>
      name === 'core.states.player.Killed'
        ? Killed
        : name === 'starling.text.TextField'
          ? Text
          : {},
    after(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'after', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installDeathPresentation(api);
  const state = new Killed();
  try {
    state.enter();
    assert.equal(state.deathInfo.format.font, 'DAIDRR_24');
    assert.equal(state.experience.format.font, 'DAIDRR_16');
    assert.equal(state.respawnText.format.font, 'DAIDRR');
    state.ready = true;
    state.execute();
    assert.equal(state.respawnText.format.font, 'DAIDRR_24');
    const pivots = state.respawnText.pivots;
    state.execute();
    assert.equal(state.respawnText.pivots, pivots);
    const other = new Killed();
    other.player.isMe = false;
    other.enter();
    assert.equal(other.deathInfo.format.font, 'DAIDRR');
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(state.deathInfo.format.font, 'DAIDRR');
  assert.equal(state.experience.format.font, 'DAIDRR');
  assert.equal(state.respawnText.format.font, 'DAIDRR');
  assert.equal(state.respawnText.format.size, 20);
});
