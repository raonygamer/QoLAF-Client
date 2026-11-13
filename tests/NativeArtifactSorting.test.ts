import type { Artifact, Player, GameScene } from '../src/game/Bindings';
import { bindGameClasses } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import { Display } from './fixtures/NativeGame';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installArtifactUI } from '../src/artifacts/NativeArtifacts';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('fitness sorting preserves source reveal ordering and resets the rebuilt inventory scroll', () => {
  const hooks = new Hooks();
  const calls: unknown[] = [];
  class Cargo {
    addToolTip() {}
  }
  class Box {
    setArtifact() {}
  }
  class Overview {
    p = {
      artifacts: [
        { id: 'hidden-low', revealed: false, stats: [{ type: 'dotDamage', value: 1 }] },
        { id: 'shown-low', revealed: true, stats: [{ type: 'dotDamage', value: 1 }] },
        { id: 'hidden-high', revealed: false, stats: [{ type: 'dotDamage', value: 2 }] },
        { id: 'shown-high', revealed: true, stats: [{ type: 'dotDamage', value: 2 }] },
      ],
    };
    chooseSortingButton = { set_enabled: (value: boolean) => calls.push(value) };
    cargoBoxes: unknown[] = ['stale'];
    cargoContainer = {
      removeChildren: (...args: unknown[]) => calls.push(args),
      scrollToPosition: (...args: unknown[]) => calls.push(args),
    };
    chooseSorting() {}
    reloadStats() {}
    dispose() {}
    drawArtifactsInCargo() {
      calls.push('draw');
    }
    onSort(order: string) {
      calls.push(['native', order]);
    }
  }
  const classes: Record<string, any> = {
    'core.artifact.ArtifactCargoBox': Cargo,
    'core.artifact.ArtifactBox': Box,
    'core.artifact.ArtifactOverview': Overview,
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as API);
  installArtifactUI(
    {
      cls: (name: string) => classes[name],
      after: (target: any, name: string, callback: Function) =>
        hooks.add(target, name, 'after', callback),
      before: (target: any, name: string, callback: Function) =>
        hooks.add(target, name, 'before', callback),
      defer() {},
      around: (target: any, name: string, callback: Function) =>
        hooks.add(target, name, 'around', callback),
    } as any,
    () => {
      throw Error('Not opening a dialog in comparator test');
    },
  );
  const view = new Overview();
  view.onSort('fitnesshigh');
  assert.deepEqual(
    view.p.artifacts.map((a) => a.id),
    ['shown-high', 'shown-low', 'hidden-high', 'hidden-low'],
  );
  assert.deepEqual(calls, [true, [0, -1, true], 'draw', [0, 0]]);
  assert.deepEqual(view.cargoBoxes, []);
  view.onSort('fitnesslow');
  assert.deepEqual(
    view.p.artifacts.map((a) => a.id),
    ['shown-low', 'shown-high', 'hidden-low', 'hidden-high'],
  );
  for (const artifact of view.p.artifacts)
    Object.assign(artifact, {
      getStat: () => (artifact.id.endsWith('low') ? 20 : 10),
    });
  view.onSort('shield');
  assert.deepEqual(
    view.p.artifacts.map((a) => a.id),
    ['shown-low', 'shown-high', 'hidden-low', 'hidden-high'],
  );
  assert.deepEqual(calls.slice(-2), ['draw', [0, 0]]);
});

test('source potential, modifier, name and adequacy orders retain reveal grouping and tier families', async () => {
  const { artifactOrder, artifactAdequacy } = await import('../src/artifacts/ArtifactOrder');
  const a = {
    id: 'a',
    name: 'Alpha',
    level: 5,
    levelPotential: 50,
    revealed: true,
    stats: [
      { type: 'healthAdd2', value: 1 },
      { type: 'healthAdd3', value: 2 },
    ],
  } as unknown as Artifact;
  const b = {
    id: 'b',
    name: 'Beta',
    level: 10,
    revealed: true,
    stats: [
      { type: 'healthAdd', value: 3 },
      { type: 'shieldAdd', value: 1 },
    ],
  } as unknown as Artifact;
  const c = {
    id: 'c',
    name: 'Gamma',
    level: 20,
    revealed: true,
    stats: [{ type: 'shieldAdd2', value: 1 }],
  } as unknown as Artifact;
  const hidden = {
    id: 'd',
    name: 'Hidden',
    level: 100,
    revealed: false,
    stats: [],
  } as unknown as Artifact;
  const player = {
    artifacts: [hidden, c, b, a],
    get_activeArtifacts: () => ['a', 'c', 'd'],
    getArtifactById: (id: string) => [a, b, c, hidden].find((art) => art.id === id),
  } as unknown as Player;
  assert.equal(
    'activeArtifacts' in player,
    false,
    'native player exposes a getter, not an AS3 field',
  );
  const adequacy = artifactAdequacy(player);
  assert.equal(adequacy.get(a), 100);
  assert.equal(adequacy.get(b), 75);
  assert.equal(adequacy.get(c), 50);
  assert.equal(adequacy.get(hidden), 0);
  assert.ok(!('adequacyValue' in a), 'presentation ranking must not mutate server artifacts');
  for (const [order, expected] of [
    ['potentialhigh', ['a', 'c', 'b', 'd']],
    ['levellow', ['a', 'b', 'c', 'd']],
    ['adequacyhigh', ['a', 'b', 'c', 'd']],
    ['adequacylow', ['c', 'b', 'a', 'd']],
    ['nameasc', ['a', 'b', 'c', 'd']],
    ['namedesc', ['c', 'b', 'a', 'd']],
    ['modifiershigh', ['b', 'a', 'c', 'd']],
  ] as const)
    assert.deepEqual(
      [...player.artifacts].sort(artifactOrder(player, order)!).map((art) => art.id),
      expected,
      order,
    );
  assert.equal(artifactOrder(player, 'shield'), null);
});

test('source sorting screen routes every action and closes once without sorting on Close', async () => {
  const { createArtifactSorting } = await import('../src/artifacts/ArtifactSorting');
  class Node extends Display {
    constructor() {
      super();
      this.set_width(80);
      this.set_height(30);
    }
  }
  class Quad extends Node {
    constructor(
      w: number,
      h: number,
      public color: number,
    ) {
      super();
      this.set_width(w);
      this.set_height(h);
    }
  }
  class Button extends Node {
    constructor(
      public callback: Function,
      public label: string,
    ) {
      super();
    }
  }
  const types = [
    { type: 'healthAdd', name: 'Health', bitmap: 'hp' },
    { type: 'healthAdd2', name: 'Tier 2', bitmap: 'hp2' },
    { type: 'increaseRecyleRate', name: 'Recycle', bitmap: 'recycle' },
  ];
  const classes: Record<string, any> = {
    'starling.display.Sprite': Node,
    'starling.display.Quad': Quad,
    'starling.display.Image': Node,
    'starling.text.TextField': Node,
    'starling.text.TextFormat': Node,
    'core.text.VerdanaBitmapFontRegistry': { fontNameForSize: () => 'Verdana' },
    'core.hud.components.Button': Button,
    'core.hud.components.ToolTip': Node,
    'feathers.controls.ScrollContainer': Node,
    'generics.Localize': { t: (s: string) => s },
    'textures.TextureLocator': { getService: () => ({ getTextureGUIByKey: (s: string) => s }) },
    'generics.ObjUtils': { ToVector: (table: unknown) => table },
    'core.artifact.Artifact': { TYPE_INCREASE_RECYCLE_RATE: 'increaseRecyleRate' },
  };
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as API);
  const Popup = createArtifactSorting((name) => classes[name]);
  const game = { dataManager: { loadTable: () => types } } as unknown as GameScene;
  const actions: string[] = [];
  const popup = new Popup(
    game,
    (order: string) => actions.push(order),
    () => actions.push('close'),
  );
  const buttons = (popup as unknown as Node).children.filter(
    (node): node is Button => node instanceof Button,
  );
  assert.equal(buttons.length, 11);
  const adequacy = buttons.find((button) => button.label === 'Adequacy high');
  assert.ok(adequacy);
  adequacy.callback();
  popup.close();
  assert.deepEqual(actions, ['adequacyhigh', 'close']);
  for (const [label, order] of [
    ['Strength high', 'levelhigh'],
    ['Strength low', 'levellow'],
    ['Fitness high', 'fitnesshigh'],
    ['Fitness low', 'fitnesslow'],
    ['Potential high', 'potentialhigh'],
    ['Potential low', 'potentiallow'],
    ['Adequacy high', 'adequacyhigh'],
    ['Adequacy low', 'adequacylow'],
    ['Modifiers high', 'modifiershigh'],
    ['Modifiers low', 'modifierslow'],
  ]) {
    const routed: string[] = [];
    const view = new Popup(
      game,
      (value) => routed.push(value),
      () => routed.push('close'),
    );
    const button = (view as unknown as Node).children.find(
      (node) => node instanceof Button && node.label === label,
    );
    assert.ok(button instanceof Button, label);
    button.callback();
    button.callback();
    assert.deepEqual(routed, [order, 'close'], label);
  }
  const closeOnly = new Popup(
    game,
    () => assert.fail('Close must not sort'),
    () => actions.push('cancel'),
  );
  const close = (closeOnly as unknown as Node).children.find(
    (node) => node instanceof Button && node.label === 'Close',
  );
  assert.ok(close instanceof Button);
  close.callback();
  assert.equal(actions.at(-1), 'cancel');
  const body = (popup as unknown as Node).children.find((node: any) => node.children.length)
    ?.children[0];
  assert.ok(body);
  assert.deepEqual(
    body.children.map((node) => node.get_name()),
    ['healthAdd', 'increaseRecyleRate'],
  );
});

test('sorting popup toggles, centers in expanded view, preserves controls and disposes with overview', () => {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanup: Function[] = [];
  const actions: unknown[] = [];
  class Node {
    parent: Node | null = null;
    children: Node[] = [];
    removed = false;
    get_parent() {
      return this.parent;
    }
    addChild(node: Node) {
      node.parent = this;
      this.children.push(node);
    }
    setChildIndex(node: Node, index: number) {
      this.children.splice(this.children.indexOf(node), 1);
      this.children.splice(index, 0, node);
    }
    get_numChildren() {
      return this.children.length;
    }
    removeFromParent(dispose: boolean) {
      this.removed = dispose;
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    }
  }
  class Overview extends Node {
    g = {};
    expandedView = true;
    viewWidth = 1000;
    viewHeight = 700;
    sortingBar = new Node();
    layoutToggleButton = new Node();
    closeViewButton = new Node();
    chooseSortingButton = { set_enabled: (value: boolean) => actions.push(value) };
    constructor() {
      super();
      this.addChild(this.sortingBar);
      this.addChild(this.layoutToggleButton);
      this.addChild(this.closeViewButton);
    }
    chooseSorting() {
      assert.fail('old sorting screen should not open');
    }
    onSort(_order: string) {}
    reloadStats() {}
    dispose() {
      actions.push('dispose');
    }
  }
  class Popup extends Node {
    x = 0;
    y = 0;
    set_x(value: number) {
      this.x = value;
    }
    set_y(value: number) {
      this.y = value;
    }
    constructor(
      public g: unknown,
      public sort: Function,
      public close: Function,
      public black: boolean,
    ) {
      super();
    }
  }
  class Box {
    addToolTip() {}
    setArtifact() {}
  }
  const classes: Record<string, any> = {
    'core.artifact.ArtifactCargoBox': Box,
    'core.artifact.ArtifactBox': Box,
    'core.artifact.ArtifactOverview': Overview,
  };
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
  };
  for (const kind of ['before', 'after', 'around'])
    api[kind] = (target: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, kind, fn));
  bindGameClasses({ cls: (name: string) => classes[name] ?? {} } as API);
  installArtifactUI(
    api,
    () => Popup as unknown as ReturnType<Parameters<typeof installArtifactUI>[1]>,
  );
  const view = new Overview();
  view.chooseSorting();
  const popup = view.children[0] as Popup;
  assert.ok(popup instanceof Popup);
  assert.equal(popup.x, 168);
  assert.equal(popup.y, 90);
  assert.equal(popup.black, true);
  assert.deepEqual(view.children.slice(1), [
    view.sortingBar,
    view.layoutToggleButton,
    view.closeViewButton,
  ]);
  view.chooseSorting();
  assert.equal(popup.removed, true);
  assert.equal(view.children.length, 3);
  view.expandedView = false;
  view.chooseSorting();
  const compact = view.children[0] as Popup;
  assert.equal(compact.x, 0);
  assert.equal(compact.y, 0);
  assert.equal(compact.black, false);
  compact.close();
  assert.equal(compact.removed, true);
  view.chooseSorting();
  const last = view.children[0];
  view.dispose();
  assert.equal(last.removed, true);
  assert.equal(actions.at(-1), 'dispose');
  cleanup.reverse().forEach((fn) => fn());
  assert.deepEqual(errors, []);
});
