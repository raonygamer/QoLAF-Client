import { bindGameClasses } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtifactFavorites } from '../src/artifacts/ArtifactFavorites';
import { ArtifactPurify, selectPurifyArtifacts } from '../src/artifacts/ArtifactPurify';

function fixture() {
  const favorites = new ArtifactFavorites({ get: (_key, fallback) => fallback, set() {} });
  const artifact = (id: string, extra: any = {}) => ({
    id,
    name: id,
    level: 80,
    revealed: false,
    stats: [],
    get_isUnique: () => false,
    ...extra,
  });
  const artifacts = [
    artifact('favorite'),
    artifact('revealed', { revealed: true }),
    artifact('unique', { get_isUnique: () => true }),
    artifact('generator', { name: 'Recycle Generator' }),
    ...Array.from({ length: 45 }, (_, index) => artifact(String(index))),
  ];
  favorites.setFavorite('player', 'favorite', true);
  const p = {
    id: 'player',
    artifacts,
    artifactCount: artifacts.length,
    get_artifactLimit: () => 100,
  };
  const errors: string[] = [],
    requests: any[] = [],
    items: any[] = [];
  let hideLimit = 0;
  const game = {
    artifactRecyclePending: false,
    myCargo: {
      isFull: false,
      get_isFull() {
        return this.isFull;
      },
      addItem: (...args: any[]) => items.push(args),
    },
    hud: { hideArtifactLimitText: () => hideLimit++ },
    showErrorDialog: (message: string) => errors.push(message),
    createMessage: (type: string) => ({
      type,
      ids: [] as string[],
      add(id: string) {
        this.ids.push(id);
      },
    }),
    rpcMessage: (message: any, callback: Function) => requests.push({ message, callback }),
  };
  const view: any = {
    p,
    g: game,
    cargoBoxes: artifacts.map((a) => ({
      a,
      selected: false,
      setSelectedForRecycle() {
        this.selected = true;
      },
      setEmpty() {
        this.a = null as any;
      },
    })),
    purifyButton: {
      enabled: false,
      set_enabled(value: boolean) {
        this.enabled = value;
      },
    },
  };
  const controller = new ArtifactPurify(view, favorites, (text) => `Localized ${text}`);
  return {
    favorites,
    view,
    p,
    game,
    errors,
    requests,
    items,
    controller,
    hideLimit: () => hideLimit,
  };
}
const filters = { fitness: 110, strength: 90, lines: 0 };
const response = (values: any[]) => ({
  getBoolean: (i: number) => values[i],
  getString: (i: number) => values[i],
  getInt: (i: number) => values[i],
  length: values.length,
});

test('purify keeps cargo order, caps at 40, and excludes revealed, unique, favorites and generator', () => {
  const { view, favorites } = fixture();
  assert.deepEqual(
    selectPurifyArtifacts(view, filters, favorites).map((a) => a.id),
    Array.from({ length: 40 }, (_, i) => String(i)),
  );
  assert.equal(
    selectPurifyArtifacts(view, { fitness: 0, strength: 80, lines: 0 }, favorites).length,
    0,
    'equal minimum is accepted',
  );
  assert.equal(
    selectPurifyArtifacts(view, { fitness: 0, strength: 80, lines: 1 }, favorites).length,
    40,
    'a single failed minimum is sufficient',
  );
});

test('purify submits exact IDs and applies the authoritative response only once', () => {
  const { controller, game, view, requests, p, items, hideLimit } = fixture();
  const before = p.artifactCount;
  controller.recycle(filters);
  assert.equal(game.artifactRecyclePending, true);
  assert.equal(requests[0].message.type, 'bulkRecycle');
  assert.equal(requests[0].message.ids.length, 40);
  assert.equal(p.artifactCount, before, 'inventory must remain unchanged until success');
  controller.recycle(filters);
  assert.equal(requests.length, 1);
  const result = response([true, 'junk', 40]);
  requests[0].callback(result);
  requests[0].callback(result);
  assert.equal(game.artifactRecyclePending, false);
  assert.equal(p.artifactCount, before - 40);
  assert.deepEqual(items, [['Commodities', 'junk', 40]]);
  assert.equal(hideLimit(), 1);
  assert.equal(view.purifyButton.enabled, true);
  assert.equal(view.cargoBoxes.filter((box: any) => box.a === null).length, 40);
});

test('empty selection, overloaded cargo, errors and synchronous submission failure preserve inventory', () => {
  const f = fixture();
  const before = f.p.artifactCount;
  f.controller.recycle({ fitness: 0, strength: 0, lines: 0 });
  assert.deepEqual(f.errors, ['No artifacts to recycle.']);
  f.game.myCargo.isFull = true;
  f.controller.recycle(filters);
  assert.match(f.errors.at(-1)!, /^Localized Your cargo compressor/);
  assert.equal(f.requests.length, 0);
  f.game.myCargo.isFull = false;
  f.controller.recycle(filters);
  f.requests[0].callback(response([false, 'server rejected']));
  assert.equal(f.p.artifactCount, before);
  assert.equal(f.game.artifactRecyclePending, false);
  assert.equal(f.errors.at(-1), 'server rejected');
  f.game.rpcMessage = () => {
    throw Error('offline');
  };
  assert.throws(() => f.controller.recycle(filters), /offline/);
  assert.equal(f.game.artifactRecyclePending, false);
  assert.equal(f.view.purifyButton.enabled, true);
});

test('closing a screen keeps the game request locked and accepts its response without touching disposed controls', () => {
  const f = fixture();
  f.controller.recycle(filters);
  f.controller.disposed = true;
  f.view.purifyButton.set_enabled = () => assert.fail('disposed button');
  for (const box of f.view.cargoBoxes) box.setEmpty = () => assert.fail('disposed box');
  const reopened = { ...f.view, purifyButton: { set_enabled() {} } };
  new ArtifactPurify(reopened, f.favorites, (text) => text).recycle(filters);
  assert.equal(f.requests.length, 1);
  f.requests[0].callback(response([true, 'junk', 40]));
  assert.equal(f.game.artifactRecyclePending, false);
  assert.equal(f.p.artifactCount, 9);
});

test('native Purify controls match source positions, use saved filters and persist only on Save', async () => {
  const { installArtifactPurify } = await import('../src/artifacts/ArtifactPurify');
  // @ts-expect-error production hook dispatcher
  const { Hooks } = await import('./fixtures/HostCore.js');
  const hooks = new Hooks();
  const cleanup: Function[] = [];
  const saved: any[] = [];
  class Node {
    x = 0;
    y = 0;
    width = 40;
    height = 25;
    text = '';
    disposed = false;
    set_x(v: number) {
      this.x = v;
    }
    set_y(v: number) {
      this.y = v;
    }
    set_text(v: string) {
      this.text = v;
    }
    get_width() {
      return this.width;
    }
    get_height() {
      return this.height;
    }
    get_text() {
      return this.text;
    }
    set_visible(_v: boolean) {}
    set_isEnabled(_v: boolean) {}
    set_enabled(_v: boolean) {}
    set_restrict(v: string) {
      assert.equal(v, '0-9');
    }
    set_maxChars(v: number) {
      assert.equal(v, 3);
    }
    removeFromParent() {
      this.disposed = true;
    }
  }
  class Input extends Node {
    constructor(x: number, y: number, width: number, height: number) {
      super();
      Object.assign(this, { x, y, width, height });
    }
  }
  class Text extends Node {
    constructor(x: number, y: number, text: string, _size: number) {
      super();
      Object.assign(this, { x, y, text });
    }
  }
  class Button extends Node {
    constructor(
      public action: () => void,
      text: string,
      style: string,
    ) {
      super();
      this.text = text;
      assert.equal(style, 'positive');
    }
  }
  const f = fixture();
  class Overview {
    children: any[] = [];
    p = f.p;
    g = f.game;
    cargoBoxes = f.view.cargoBoxes;
    [key: string]: any;
    addChild(node: Node) {
      this.children.push(node);
    }
    drawComponents() {}
    dispose() {}
  }
  const classes: any = {
    'core.artifact.ArtifactOverview': Overview,
    'core.hud.components.InputText': Input,
    'core.hud.components.Button': Button,
    'core.hud.components.TextBitmap': Text,
    'generics.Localize': { t: (text: string) => text },
  };
  const api: any = {
    cls: (name: string) => classes[name],
    storage: {
      get: () => ({ fitness: 0, strength: 0, lines: 0 }),
      set: (key: string, value: any) => saved.push([key, value]),
    },
    defer: (fn: Function) => cleanup.push(fn),
    after: (target: any, key: string, fn: Function) => hooks.add(target, key, 'after', fn),
    before: (target: any, key: string, fn: Function) => hooks.add(target, key, 'before', fn),
  };
  bindGameClasses({ ...api, cls: (name: string) => classes[name] ?? {} });
  installArtifactPurify(api, f.favorites);
  const view = new Overview();
  view.drawComponents();
  assert.deepEqual(
    [view.lineInput.x, view.lineInput.y, view.fitnessInput.y, view.strengthInput.y],
    [458, 426, 453, 480],
  );
  assert.deepEqual(
    [view.purifyButton.x, view.purifyButton.y, view.saveStatsButton.y],
    [380, 480, 445],
  );
  view.strengthInput.set_text('90');
  view.purifyButton.action();
  assert.equal(f.requests.length, 0, 'unsaved edits must not change active filters');
  view.saveStatsButton.action();
  assert.deepEqual(saved, [['artifact.purify', { fitness: 0, strength: 90, lines: 0 }]]);
  view.purifyButton.action();
  assert.equal(f.requests.length, 1);
  view.dispose();
  assert.ok(view.children.every((node) => node.disposed));
  const expanded = new Overview();
  expanded.expandedView = true;
  expanded.infoX = 900;
  expanded.viewHeight = 800;
  expanded.drawComponents();
  assert.deepEqual(
    [expanded.lineInput.x, expanded.lineInput.y, expanded.fitnessInput.y, expanded.strengthInput.y],
    [900, 620, 648, 676],
  );
  assert.equal(expanded.strengthInput.text, '90');
  expanded.cargoBoxes = f.p.artifacts.map((a) => ({
    a,
    setEmpty() {
      this.a = null as any;
    },
  }));
  f.requests[0].callback(response([true, 'junk', 40]));
  assert.equal(
    expanded.cargoBoxes.filter((box: any) => !box.a).length,
    40,
    'the reopened screen reconciles tiles when the retired screen receives its response',
  );
  assert.deepEqual([expanded.purifyButton.y, expanded.saveStatsButton.x], [712, 950]);
  for (const off of cleanup) off();
  assert.ok(expanded.children.every((node) => node.disposed));
});
