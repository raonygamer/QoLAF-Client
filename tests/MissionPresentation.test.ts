import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installMissionPresentation } from '../src/missions/MissionPresentation';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('mission construction chooses source atlases before measurement and translates only commodity tooltips', () => {
  class Format {
    constructor(
      public font: string,
      public size: number,
    ) {}
    get_font() {
      return this.font;
    }
    get_size() {
      return this.size;
    }
    set_font(font: string) {
      return (this.font = font);
    }
    clone() {
      return new Format(this.font, this.size);
    }
  }
  const definition = { name: 'Ore', bitmap: 'ore' };
  class Data {
    loadKey(_table: string, _key: string) {
      return definition;
    }
  }
  class Tip {
    s: string;
    installed = '';
    constructor(
      text: string,
      public type = 'dailyView',
    ) {
      this.s = text;
      this.addListeners();
    }
    addListeners() {
      this.installed = this.s;
    }
    set_text(text: string) {
      return (this.s = text);
    }
  }
  const data = new Data();
  let fail = false;
  class Reward {
    format?: Format;
    item?: Tip;
    unrelated?: Tip;
    wrongType?: Tip;
    draw() {
      this.format = new Format('font13', 13).clone();
      const item = data.loadKey('Commodities', 'ore');
      this.item = new Tip(item.name);
      this.unrelated = new Tip('Already translated XP');
      this.wrongType = new Tip(item.name, 'other');
      if (fail) throw Error('reward layout failed');
    }
  }
  class Daily {
    field?: Format;
    addHeader() {
      this.field = new Format('font13', 13).clone();
    }
    addDescription() {
      this.field = new Format('Verdana', 12).clone();
      assert.equal(this.field.font, 'verdana16_bitmap');
      this.field.set_font('DAIDRR');
      this.field.size = 16;
    }
    addProgress() {
      this.field = new Format('Verdana', 11).clone();
    }
  }
  class Mission {
    field?: Format;
    addReward() {
      this.field = new Format('DAIDRR', 12).clone();
      return 47;
    }
  }
  const classes: Record<string, unknown> = {
    'core.states.gameStates.missions.DailyReward': Reward,
    'core.states.gameStates.missions.DailyView': Daily,
    'core.states.gameStates.missions.MissionView': Mission,
    'starling.text.TextFormat': Format,
    'data.DataManager': Data,
    'core.hud.components.ToolTip': Tip,
    'generics.Localize': { t: (value: string) => 'Translated ' + value },
  };
  const cleanup: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (owner: object, name: string, callback: unknown) => {
    const off = hooks.add(owner, name, kind, callback);
    cleanup.push(off);
    return off;
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    before: hook('before'),
    after: hook('after'),
    around: hook('around'),
    defer: (callback: () => void) => cleanup.push(callback),
  } as unknown as API;
  bindGameClasses(api);
  installMissionPresentation(api);
  const reward = new Reward();
  const daily = new Daily();
  const mission = new Mission();
  reward.draw();
  assert.equal(reward.format?.font, 'DAIDRR_16');
  assert.equal(reward.item?.installed, 'Translated Ore');
  assert.equal(reward.unrelated?.s, 'Already translated XP');
  assert.equal(reward.wrongType?.s, 'Ore');
  assert.deepEqual(definition, { name: 'Ore', bitmap: 'ore' });
  daily.addHeader();
  assert.equal(daily.field?.font, 'DAIDRR_16');
  daily.addProgress();
  assert.equal(daily.field?.font, 'verdana16_bitmap');
  daily.addDescription();
  assert.equal(daily.field?.font, 'DAIDRR_16');
  assert.equal(daily.field?.size, 16);
  assert.equal(mission.addReward(), 47);
  assert.equal(mission.field?.font, 'DAIDRR_16');
  fail = true;
  assert.throws(() => new Reward().draw(), /reward layout failed/);
  assert.equal(new Format('font13', 13).clone().font, 'font13');
  assert.equal(new Tip('Ore').s, 'Ore');
  cleanup.reverse().forEach((off) => off());
  assert.equal(reward.format?.font, 'font13');
  assert.equal(reward.item?.s, 'Ore');
  assert.equal(daily.field?.font, 'DAIDRR', 'restore last native requested font');
  assert.equal(mission.field?.font, 'DAIDRR');
});
