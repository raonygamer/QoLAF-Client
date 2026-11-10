import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClanLabel } from '../src/UI/ClanLabel';
import { Display } from './Fixtures/NativeGame';

class Text extends Display {
  text = '';
  format = {
    color: 0,
    font: '',
    set_font: (font: string) => {
      this.format.font = font;
    },
    set_color: (color: number) => {
      this.format.color = color;
    },
    set_horizontalAlign() {},
  };
  constructor(_x: number, _y: number, _text: string, size: number) {
    super();
    this.set_height(size + 4);
  }
  get_format() {
    return this.format;
  }
  set_text(text: string) {
    this.text = text;
    this.set_width(text.length * 7 + 4);
  }
  get_text() {
    return this.text;
  }
  set_batchable() {}
  set_blendMode() {}
}

test('clan identity rejects stale callbacks, retries, follows visibility and native label layout', () => {
  const callbacks: Function[] = [];
  const requests: string[] = [];
  let now = 0;
  const settings = { showPlayerClanIdentification: true };
  const ui: any = {
    sprite: () => new Display(),
    texture: () => {
      throw Error('missing logo');
    },
    cls: (name: string) =>
      ({
        'core.hud.components.TextBitmap': Text,
        'data.DataLocator': {
          getService: () => ({
            loadKeyFromBigDB: (_table: string, id: string, callback: Function) => {
              requests.push(id);
              callbacks.push(callback);
            },
          }),
        },
        'core.states.gameStates.ClanState': { getMemberRankName: () => 'Officer' },
      })[name],
    api: { cls: () => ({ settings }) },
    dispose: (node: Display) => node.removeFromParent(true),
  };
  const parent = new Display();
  const nameText = new Text(0, 0, '', 13);
  nameText.set_y(100);
  parent.addChild(nameText);
  const player = { id: 'p1', clanId: 'one' };
  const ship: any = { player, lifecycleId: 1, nameText, _mc: new Display() };
  ship._mc.set_x(200);
  const label = new ClanLabel(ui, { me: {} }, ship, () => now);
  label.update();
  label.update();
  assert.deepEqual(requests, ['one']);
  now = 10000;
  label.update();
  assert.deepEqual(requests, ['one', 'one']);
  callbacks[0]({ name: 'Stale', color: 1 });
  label.update();
  assert.equal(label.node.get_visible(), false, 'old attempt cannot override a retry');
  callbacks[1]({ name: 'Current', color: 123 });
  label.update();
  assert.equal(label.node.get_visible(), true, 'missing logo does not hide text');
  const [clan, role] = label.node.children as Text[];
  assert.equal(clan.text, 'Current');
  assert.equal(role.text, 'Officer');
  assert.equal(clan.format.font, 'DAIDRR_COMBAT');
  assert.equal(clan.format.color, 123);
  assert.equal(label.node.get_y(), 100 - (17 + 15 - 5));
  assert.equal(label.node.get_x(), 200 - 53 / 2);
  settings.showPlayerClanIdentification = false;
  label.update();
  assert.equal(label.node.get_visible(), false);
  settings.showPlayerClanIdentification = true;
  nameText.set_visible(false);
  label.update();
  assert.equal(label.node.get_visible(), false);
  nameText.set_visible(true);
  player.clanId = 'two';
  label.update();
  assert.equal(label.node.get_visible(), false);
  callbacks[1]({ name: 'Old clan', color: 1 });
  label.update();
  assert.equal(label.node.get_visible(), false);
  label.dispose();
  callbacks[2]({ name: 'Too late', color: 1 });
  assert.equal(label.node.disposed, true);
});
