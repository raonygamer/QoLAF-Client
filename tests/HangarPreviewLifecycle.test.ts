import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installHangarPreviewLifecycle } from '../src/ship/HangarPreviewLifecycle';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('hangar construction failures release attached and detached sections and both engine emitters', () => {
  const failure = new Error('preview data unavailable');
  class Section {
    disposals = 0;
    constructor(readonly attached = false) {}
    get_parent() {
      return this.attached ? {} : null;
    }
    dispose() {
      this.disposals++;
    }
  }
  class Preview {
    buyContainer = new Section();
    premanufacturedDetails = new Section();
    specialweapon = new Section(true);
    premanufactured = new Section();
    specialStats = new Section();
    desc = new Section(true);
    stats: Section | null = null;
    emitters: Array<{ killEmitter(): void }> | null = [];
    kills = 0;
    disposals = 0;
    constructor(readonly failAt = '') {}
    step(name: string) {
      if (this.failAt === name) throw failure;
    }
    addBuy() {
      this.step('addBuy');
    }
    addShip() {
      this.emitters!.push({ killEmitter: () => this.kills++ });
      this.emitters!.push({ killEmitter: () => this.kills++ });
      this.step('addShip');
    }
    addNameAndDescription() {
      this.step('addNameAndDescription');
    }
    addBaseStats() {
      this.stats = new Section();
      this.step('addBaseStats');
    }
    addSpecialStats() {
      this.step('addSpecialStats');
    }
    addSpecialWeapon() {
      this.step('addSpecialWeapon');
    }
    addPremanufacturedSkills() {
      this.step('addPremanufacturedSkills');
    }
    addPremanufacturedDetails() {
      this.step('addPremanufacturedDetails');
    }
    dispose() {
      for (const emitter of this.emitters!) emitter.killEmitter();
      this.emitters = null;
      this.specialweapon.dispose();
      this.desc.dispose();
      this.disposals++;
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const diagnostics: unknown[][] = [];
  const api = {
    cls: (name: string) => (name === 'core.hud.components.hangar.SkinItem' ? Preview : {}),
    around: (owner: object, key: string, callback: Function) => {
      const off = hooks.add(owner, key, 'around', callback);
      cleanups.push(off);
      return off;
    },
    log: (...values: unknown[]) => diagnostics.push(values),
  } as unknown as API;
  bindGameClasses(api);
  installHangarPreviewLifecycle(api);
  const steps = [
    'addBuy',
    'addShip',
    'addNameAndDescription',
    'addBaseStats',
    'addSpecialStats',
    'addSpecialWeapon',
    'addPremanufacturedSkills',
    'addPremanufacturedDetails',
  ] as const;
  try {
    for (const failAt of [...steps, '']) {
      const preview = new Preview(failAt);
      const construct = () => {
        for (const step of steps) preview[step]();
      };
      if (failAt) assert.throws(construct, (error) => error === failure);
      else construct();
      preview.dispose();
      preview.dispose();
      assert.equal(preview.disposals, 1, failAt);
      assert.equal(preview.kills, failAt === 'addBuy' ? 0 : 2, failAt);
      for (const section of [
        preview.buyContainer,
        preview.premanufacturedDetails,
        preview.specialweapon,
        preview.premanufactured,
        preview.specialStats,
        preview.desc,
        preview.stats,
      ]) {
        if (section) assert.equal(section.disposals, 1, failAt);
      }
    }
    const brokenCleanup = new Preview('addBuy');
    const cleanupFailure = new Error('cleanup unavailable');
    brokenCleanup.dispose = () => {
      throw cleanupFailure;
    };
    assert.throws(
      () => brokenCleanup.addBuy(),
      (error) => error === failure,
    );
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0][1], cleanupFailure);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});
