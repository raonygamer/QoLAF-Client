import type { GameScene } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClanLabel } from '../src/ui/ClanLabel';
import { Display } from './fixtures/NativeGame';

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
    get_color: () => this.format.color,
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
        'core.scene.SceneBase': { settings },
        'core.clan.ClanClient': { brief(_game: GameScene, id: string, _player: string, callback: Function) { requests.push(id); callbacks.push(callback); } },
      })[name],
    api: { cls: () => ({ settings }), log: (...args: unknown[]) => assert.fail(String(args)) },
    dispose: (node: Display) => node.removeFromParent(true),
  };
  const parent = new Display();
  const nameText = new Text(0, 0, '', 13);
  nameText.set_y(100);
  parent.addChild(nameText);
  const me = { id: 'local', clanId: 'one' };
  const player = { id: 'p1', clanId: 'one' };
  const ship: any = { player, lifecycleId: 1, nameText, _mc: new Display() };
  ship.get_lifecycleId = () => ship.lifecycleId;
  ship._mc.set_x(200);
  const label = new ClanLabel(
    ui,
    {
      get_me: () => me,
      get_isLeaving: () => false,
      client: {
        bigDB: {
          load(_table: string, id: string, callback: Function) {
            requests.push(id);
            callbacks.push(callback);
          },
        },
      },
    } as unknown as GameScene,
    ship,
    () => now,
  );
  label.update();
  label.update();
  assert.deepEqual(requests, ['one']);
  now = 10000;
  label.update();
  assert.deepEqual(requests, ['one', 'one']);
  callbacks[0]({ name: 'Stale', color: 1 });
  label.update();
  assert.equal(label.node.get_visible(), false, 'old attempt cannot override a retry');
  callbacks[1]({ name: 'Current', color: 123, rankName: 'Officer' });
  label.update();
  assert.equal(label.node.get_visible(), true, 'same-clan remote players remain visible even without a logo');
  const [clan, role] = [label.node.getChildAt(0), label.node.getChildAt(1)] as unknown as Text[];
  assert.equal(clan.text, 'Current');
  assert.equal(role.text, 'Officer');
  assert.equal(clan.format.font, 'DAIDRR_COMBAT');
  assert.equal(clan.format.color, 123);
  assert.equal(label.node.get_y(), 100 - (17 + 15 - 5));
  assert.equal(label.node.get_x(), 200 - 53 / 2);
  Object.assign(player, { clanRankName: 'Leader', clanLogoColor: 321 });
  label.update();
  assert.equal(role.text, 'Leader', 'cached clan identity updates the rendered rank');
  assert.equal(clan.format.color, 321);
  assert.equal(requests.length, 2, 'cached identity does not trigger another lookup');
  const reused = new ClanLabel(
    ui,
    { get_me: () => me, get_isLeaving: () => false } as unknown as GameScene,
    ship,
    () => now,
  );
  reused.update();
  assert.equal(reused.node.get_visible(), true, 'a new ship label reuses player-owned identity');
  reused.dispose();
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
  ship.lifecycleId++;
  callbacks[2]({ name: 'Old ship lifetime', color: 1 });
  assert.equal(
    label.node.get_visible(),
    false,
    'native lifecycle accessor rejects stale responses',
  );
  label.update();
  assert.deepEqual(requests, ['one', 'one', 'two', 'two']);
  label.dispose();
  callbacks[3]({ name: 'Too late', color: 1 });
  assert.equal((label.node as unknown as Display).disposed, true);
});
