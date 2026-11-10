import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installArtifactCargo } from '../src/artifacts/ArtifactCargo';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(count: number, columns = 10) {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanup: Function[] = [];
  let createdBoxes = 0;
  class Node {
    children: Node[] = [];
    parent: Node | null = null;
    listeners = new Map<string, Function>();
    x = 0;
    y = 0;
    width = 0;
    height = 28;
    text = '';
    enabled = true;
    set_enabled(value: boolean) {
      this.enabled = value;
    }
    disposed = false;
    set_x(v: number) {
      this.x = v;
    }
    set_y(v: number) {
      this.y = v;
    }
    set_width(v: number) {
      this.width = v;
    }
    set_height(v: number) {
      this.height = v;
    }
    get_height() {
      return this.height;
    }
    set_text(v: string) {
      this.text = v;
    }
    addChild(node: Node) {
      node.parent = this;
      this.children.push(node);
    }
    addEventListener(type: string, fn: Function) {
      this.listeners.set(type, fn);
    }
    removeEventListener(type: string, fn: Function) {
      if (this.listeners.get(type) === fn) this.listeners.delete(type);
    }
    removeFromParent(dispose: boolean) {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
      this.disposed = dispose;
    }
  }
  class Box extends Node {
    constructor(
      _game: unknown,
      public artifact: unknown,
    ) {
      super();
      createdBoxes++;
    }
  }
  class Button extends Node {
    constructor(
      public callback: Function,
      text: string,
    ) {
      super();
      this.text = text;
    }
  }
  class Overview extends Node {
    g = {
      isLeaving: false,
      overlays: [] as any[],
      errors: [] as string[],
      requests: [] as any[],
      addChildToOverlay(box: any) {
        this.overlays.push(box);
      },
      removeChildFromOverlay(box: any) {
        this.overlays.splice(this.overlays.indexOf(box), 1);
      },
      rpc(name: string, callback: Function) {
        this.requests.push({ name, callback });
      },
      showErrorDialog(message: string) {
        this.errors.push(message);
      },
      hud: { hideArtifactLimitText() {} },
      creditManager: { refresh() {} },
    };
    p = {
      artifacts: Array.from({ length: count }, (_, index) => ({ index })),
      artifactCount: count,
      artifactCapacityLevel: 0,
      get_artifactLimit() {
        return [100, 150][this.artifactCapacityLevel];
      },
    };
    cargoColumns = columns;
    cargoWidth = 375;
    cargoBoxes: Box[] = [];
    cargoContainer: Node | null = null;
    drawArtifactsInCargo() {
      assert.fail('old grid must not render');
    }
    onUpgradeCapacity() {
      assert.fail('verification must not purchase capacity');
    }
    onBuyArtifactConfirm(_response: any) {
      assert.fail('native inventory rebuild must not run');
    }
    dispose() {
      this.disposed = true;
    }
  }
  const classes: Record<string, any> = {
    'core.artifact.ArtifactOverview': Overview,
    'core.hud.components.ui.ScrollBox': Node,
    'core.artifact.ArtifactCargoBox': Box,
    'core.hud.components.Button': Button,
    'core.hud.components.TextBitmap': Node,
    'core.player.Player': { ARTIFACT_CAPACITY: [100, 150] },
    'generics.Localize': { t: (text: string) => text },
    'core.credits.CreditManager': { getCostArtifactCapacityUpgrade: () => 100 },
    'core.hud.components.dialogs.CreditBuyBox': Node,
  };
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
  };
  for (const kind of ['around', 'before'])
    api[kind] = (target: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, kind, fn));
  installArtifactCargo(api, () => Node);
  const view = new Overview();
  view.drawArtifactsInCargo();
  return {
    view,
    errors,
    created: () => createdBoxes,
    dispose: () => cleanup.reverse().forEach((fn) => fn()),
  };
}

test('source grid fills exact rows, retains native artifact objects and uses configured columns', () => {
  for (const [count, columns, expected] of [
    [0, 10, 100],
    [110, 10, 110],
    [111, 10, 120],
    [120, 6, 120],
  ]) {
    const f = fixture(count, columns);
    const { view } = f;
    assert.equal(view.cargoBoxes.length, expected);
    assert.equal(view.cargoBoxes[0].artifact, view.p.artifacts[0] ?? null);
    assert.equal(view.cargoBoxes[columns].y, 36);
    assert.equal(view.cargoBoxes[columns - 1].x, 36 * (columns - 1));
    assert.equal(view.cargoContainer!.children.at(-1)!.y, (expected / columns) * 36);
    assert.deepEqual(f.errors, []);
    f.dispose();
  }
});

test('capacity footer refreshes without rebuilding cargo and switches to count-only at maximum', () => {
  const f = fixture(100);
  const { view } = f;
  const original = view.cargoContainer!.children.at(-1)!;
  assert.equal(original.text, '100 / 100 INCREASE to 150');
  assert.equal(original.width, 340);
  view.p.artifactCount = 101;
  view.listeners.get('enterFrame')!();
  assert.equal(original.text, '101 / 100 INCREASE to 150');
  assert.equal(f.created(), 100);
  view.p.artifactCapacityLevel = 1;
  view.listeners.get('enterFrame')!();
  const count = view.cargoContainer!.children.at(-1)!;
  assert.equal(original.disposed, true);
  assert.equal(count.text, '101 / 150');
  view.g.isLeaving = true;
  view.p.artifactCount = 102;
  view.listeners.get('enterFrame')!();
  assert.equal(count.text, '101 / 150');
  view.dispose();
  assert.equal(view.listeners.size, 0);
  assert.deepEqual(f.errors, []);
  f.dispose();
});

test('capacity confirmation cancellation and failed responses re-enable the existing footer', () => {
  const f = fixture(40);
  const { view } = f;
  const button = view.cargoContainer!.children.at(-1)!;
  button.set_enabled(false);
  view.onUpgradeCapacity();
  assert.equal(view.g.requests.length, 0);
  view.g.overlays[0].listeners.get('close')();
  assert.equal(button.enabled, true);
  assert.equal(view.g.requests.length, 0, 'cancelling never sends a purchase');
  button.set_enabled(false);
  view.onUpgradeCapacity();
  view.g.overlays[0].listeners.get('accept')();
  assert.equal(view.g.requests[0].name, 'upgradeArtifactCapacity');
  view.g.requests[0].callback({ getBoolean: () => false, getString: () => 'rejected' });
  assert.equal(button.enabled, true);
  assert.deepEqual(view.g.errors, ['rejected']);
  assert.equal(view.p.artifactCapacityLevel, 0);
  assert.equal(f.created(), 100);
  assert.deepEqual(f.errors, []);
  f.dispose();
});

test('successful capacity response updates only footer and late response avoids disposed controls', () => {
  const f = fixture(40);
  const { view } = f;
  const boxes = [...view.cargoBoxes];
  const grid = view.cargoContainer;
  view.onBuyArtifactConfirm({ getBoolean: () => true });
  assert.equal(view.p.artifactCapacityLevel, 1);
  assert.equal(view.cargoContainer, grid);
  assert.deepEqual(view.cargoBoxes, boxes);
  assert.equal(f.created(), 100);
  assert.equal(grid!.children.at(-1)!.text, '40 / 150');
  view.onUpgradeCapacity();
  assert.equal(view.g.overlays.length, 0, 'maximum capacity does not open another purchase');
  view.dispose();
  view.onBuyArtifactConfirm({ getBoolean: () => false, getString: () => 'late failure' });
  assert.equal(view.g.errors.at(-1), 'late failure');
  assert.deepEqual(f.errors, []);
  f.dispose();
});
