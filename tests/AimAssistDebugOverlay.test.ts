import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AimAssist } from '../src/aim/AimAssist';
import { AimAssistDebugOverlay, aimAssistDebugText } from '../src/aim/AimAssistDebugOverlay';

class Node {
  [key: string]: any;
  children: Node[] = [];
  parent: Node | null = null;
  name = '';
  calls: any[][] = [];
  graphics = {
    clear: () => {
      this.calls = [];
    },
    lineStyle: (...args: any[]) => this.calls.push(['style', ...args]),
    moveTo: (...args: any[]) => this.calls.push(['move', ...args]),
    lineTo: (...args: any[]) => this.calls.push(['line', ...args]),
    drawCircle: (...args: any[]) => this.calls.push(['circle', ...args]),
  };
  constructor() {
    return new Proxy(this, {
      get(target, name, receiver) {
        if (name === 'set_mouseEnabled' || name === 'set_mouseChildren') return undefined;
        if (typeof name === 'string' && name.startsWith('set_'))
          return (value: any) => {
            target[name.slice(4)] = value;
          };
        return Reflect.get(target, name, receiver);
      },
    });
  }
  get_numChildren() {
    return this.children.length;
  }
  getChildAt(index: number) {
    return this.children[index];
  }
  addChild(child: Node) {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
  }
  removeChild(child: Node) {
    this.removeChildAt(this.children.indexOf(child));
  }
  removeChildAt(index: number) {
    this.children.splice(index, 1)[0].parent = null;
  }
}

test('source aim diagnostics retain panel geometry, ray styling, click-through and overlay cleanup', () => {
  class Format {
    constructor(
      public font: string,
      public size: number,
      public color: number,
    ) {}
  }
  const view = new AimAssistDebugOverlay((name) =>
    name === 'openfl.text.TextFormat' ? Format : Node,
  );
  const overlay = new Node();
  const unrelated = new Node();
  const stale = new Node();
  stale.name = 'qolafAimAssistDebugOverlay';
  overlay.addChild(unrelated);
  overlay.addChild(stale);
  const assist = new AimAssist({ getAimAssistBoolean: () => false, getAimAssistNumber: () => 0 });
  Object.assign(assist, {
    active: true,
    mouseAngle: 0,
    directAngle: Math.PI / 2,
    leadAngle: Math.PI,
    aimAngle: -Math.PI / 2,
    reason: 'ACTIVE: player-guided',
  });
  const target = { get_name: () => 'Boss', get_id: () => 42 };
  const snapshot = {
    assist,
    activeTarget: target,
    mouseAim: true,
    mode: 'PlayerControlled',
    ship: {
      get_weapon: () => ({ name: 'Gun', fire: true, projectileFunction: 'bullet' }),
      getGlobalPos: () => ({ x: 100, y: 200 }),
    },
    eligibility: {
      target,
      candidate: target,
      reason: 'eligible hit target',
      hitAge: 20.5,
      hitWindow: 800,
      distance: 300,
      minimumDistance: 150,
    },
  };
  view.update(overlay, snapshot);
  assert.equal(stale.parent, null);
  assert.equal(overlay.children.length, 2);
  const container = overlay.children[1];
  const [shape, field] = container.children;
  assert.equal(container.mouseEnabled, false);
  assert.equal(container.mouseChildren, false);
  assert.deepEqual([field.x, field.y, field.width, field.height], [8, 72, 460, 218]);
  assert.deepEqual(field.defaultTextFormat, new Format('_typewriter', 12, 0xffffff));
  assert.deepEqual([field.backgroundColor, field.borderColor, field.alpha], [0, 0x555555, 0.9]);
  assert.equal(field.selectable, false);
  assert.equal(field.text.split('\n').length, 14);
  assert.match(field.text, /confirmed hit: Boss #42 \| age 20 ms\/800 ms/);
  assert.match(field.text, /weapon: Gun \[bullet\] \| fire=true/);
  assert.deepEqual(
    shape.calls.filter((call) => call[0] === 'style'),
    [
      ['style', 1, 0xffffff, 0.9],
      ['style', 2, 0xffd84a, 0.9],
      ['style', 2, 0x54d9ff, 0.9],
      ['style', 3, 0x55ff77, 0.9],
      ['style', 1, 0xffffff, 0.75],
    ],
  );
  const lines = shape.calls.filter((call) => call[0] === 'line');
  for (const [index, expected] of [
    [230, 200],
    [100, 345],
    [-60, 200],
    [100, 25],
  ].entries()) {
    assert.ok(Math.abs(lines[index][1] - expected[0]) < 1e-9);
    assert.ok(Math.abs(lines[index][2] - expected[1]) < 1e-9);
  }
  assist.resetDiagnostics();
  assist.release('automation owns aim control');
  view.update(overlay, { ...snapshot, eligibility: undefined, mode: 'AutomationControlled' });
  assert.equal(overlay.children[1], container, 'reuse one panel rather than accumulate overlays');
  assert.equal(shape.calls.filter((call) => call[0] === 'line').length, 1);
  assert.match(field.text, /confirmed hit: -/);
  assert.match(
    aimAssistDebugText({ ...snapshot, ship: null, activeTarget: null }),
    /weapon: - \| fire=false/,
  );
  view.dispose();
  view.dispose();
  assert.deepEqual(overlay.children, [unrelated]);
});
