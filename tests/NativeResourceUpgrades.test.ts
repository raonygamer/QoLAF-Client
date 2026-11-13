import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeResourceUpgrades } from '../src/tech/NativeResourceUpgrades';
import { Display } from './fixtures/NativeGame';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('native ET button sends resource requests and preserves late counters after disposal', async () => {
  class Button extends Display {
    enabled = true;
    constructor(
      readonly callback = () => {},
      readonly label = '',
      readonly style = '',
    ) {
      super();
    }
    set_enabled(enabled: boolean) {
      this.enabled = enabled;
    }
  }
  class Icon {
    table = 'Weapons';
    tech = 'test';
    upgraded = 0;
    state = '';
    constructor(
      readonly level: number,
      readonly tb: Bar,
    ) {}
    upgrade() {
      this.upgraded++;
    }
    updateState(state: string) {
      this.state = state;
    }
  }
  class Bar {
    icons = Array.from({ length: 6 }, (_, index) => new Icon(index + 1, this));
    getUpgradeByLevel(level: number) {
      return this.icons[level - 1] ?? null;
    }
  }
  const sounds: string[] = [];
  let refreshes = 0;
  const sent: Array<Array<string | number>> = [];
  const replies: Array<
    (reply: { getBoolean: () => boolean; length: number; getString: () => string }) => void
  > = [];
  const cargoReplies: Array<() => void> = [];
  class Tree extends Display {
    static hasRequiredLevel(_level: number, playerLevel: number) {
      return playerLevel >= 16;
    }
    canUpgrade = true;
    me = { get_level: () => 20 };
    bar = new Bar();
    techSelectedForUpgrade: Icon | null = null;
    _nrOfUpgrades = [0, 0, 0, 0, 0, 0, 0];
    buyWithResourcesButton = new Button();
    buyWithFluxButton = new Button();
    upgradeInfo = new Display();
    myCargo = { reloadCargoFromServer: (callback: () => void) => cargoReplies.push(callback) };
    g = {
      get_me: () => this.me,
      get_connected: () => true,
      get_isLeaving: () => false,
      recovering: false,
      get_isRecoveringGameConnection: () => this.g.recovering,
      creditManager: {
        refresh: () => {
          refreshes++;
        },
      },
      createMessage: (name: string) => {
        assert.equal(name, 'upgrade');
        const values: Array<string | number> = [];
        return { add: (value: string | number) => values.push(value), values };
      },
      rpcMessage: (
        message: { values: Array<string | number> },
        reply: (typeof replies)[number],
      ) => {
        sent.push(message.values);
        replies.push(reply);
      },
      showErrorDialog: () => {},
    };
    get_stage() {
      return this.disposed ? null : this;
    }
    load() {
      this.buyWithResourcesButton.set_height(30);
      this.buyWithResourcesButton.set_y(100);
    }
    canAfford() {
      return true;
    }
    disableTouch() {}
    enableTouch() {}
    handleClickTechIcon(icon: Icon) {
      this.techSelectedForUpgrade = icon;
      this.buyWithResourcesButton.set_visible(true);
    }
    handleClickEliteTechIcon() {
      this.techSelectedForUpgrade = null;
    }
    updateTechUpgradeInfo() {}
  }
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const hook = (kind: string) => (target: object, key: string, callback: Function) => {
    const off = hooks.add(target, key, kind, callback);
    cleanups.push(off);
    return off;
  };
  const classes = {
    'core.hud.components.techTree.TechTree': Tree,
    'core.hud.components.Button': Button,
    'sound.SoundLocator': { getService: () => ({ play: (key: string) => sounds.push(key) }) },
  };
  const api = {
    cls: (name: string) => Reflect.get(classes, name) ?? {},
    after: hook('after'),
    before: hook('before'),
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installNativeResourceUpgrades(api);
  try {
    const tree = new Tree();
    tree.load();
    const button = tree.children.find((child) => child instanceof Button) as Button;
    assert.equal(button.get_visible(), false);
    tree.handleClickTechIcon(tree.bar.icons[4]);
    assert.equal(button.label, 'Upgrade to ET');
    assert.equal(button.style, 'positive');
    assert.equal(button.get_y(), 138);
    assert.equal(button.enabled, true);
    tree.disableTouch();
    assert.equal(button.enabled, false);
    button.callback();
    assert.equal(sent.length, 0, 'ordinary upgrade locks batch control too');
    tree.enableTouch();
    tree.g.recovering = true;
    button.callback();
    assert.equal(sent.length, 0, 'recovery cannot start a resource purchase');
    tree.g.recovering = false;
    button.callback();
    button.callback();
    assert.deepEqual(sent, [['Weapons', 'test', 5]]);
    replies.shift()!({ getBoolean: () => true, length: 1, getString: () => '' });
    await new Promise((resolve) => setTimeout(resolve, 65));
    assert.deepEqual(sent[1], ['Weapons', 'test', 6]);
    assert.equal(tree.bar.icons[4].upgraded, 1);
    assert.deepEqual(sounds, ['7zeIcPFb-UWzgtR_3nrZ8Q']);
    assert.equal(refreshes, 1);
    tree.dispose();
    replies.shift()!({ getBoolean: () => true, length: 1, getString: () => '' });
    assert.deepEqual(tree._nrOfUpgrades, [2, 0, 0, 0, 0, 1, 1]);
    assert.equal(tree.bar.icons[5].upgraded, 0, 'late ack cannot touch disposed icons');
    assert.equal(cargoReplies.length, 0, 'late ack cannot restart view work');
    assert.equal(sounds.length, 1, 'late ack cannot play stale completion feedback');
    assert.equal(refreshes, 1);
    const recoveringTree = new Tree();
    recoveringTree.load();
    recoveringTree.handleClickTechIcon(recoveringTree.bar.icons[0]);
    const recoveringButton = recoveringTree.children.find(
      (child) => child instanceof Button,
    ) as Button;
    recoveringButton.callback();
    assert.equal(sent.length, 3);
    recoveringTree.g.recovering = true;
    replies.shift()!({ getBoolean: () => true, length: 1, getString: () => '' });
    await new Promise((resolve) => setTimeout(resolve, 65));
    assert.equal(sent.length, 3, 'recovery during acknowledgement stops the batch');
    assert.equal(recoveringTree._nrOfUpgrades[1], 1, 'already accepted upgrade is counted');
    assert.equal(recoveringTree.bar.icons[0].upgraded, 0);
    assert.equal(sounds.length, 1);
    assert.equal(refreshes, 1);
    recoveringTree.dispose();
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
});
