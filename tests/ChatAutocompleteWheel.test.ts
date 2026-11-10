import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routeAutocompleteWheel } from '../src/chat/ChatAutocompleteWheel';

test('wheel routing respects scaled stage coordinates, popup bounds and covering windows', () => {
  let hit: any;
  let lastPoint: any;
  const stage = {
    hitTest(point: any) {
      lastPoint = point;
      return hit;
    },
  };
  const parent = { visible: true, alpha: 1 };
  const lower = {
    node: { stage, parent, bounds: { x: 10, y: 100, width: 200, height: 999 } },
    height: 78,
    scroll: (delta: number) => scrolls.push(['lower', delta]),
  };
  const upper = {
    node: { stage, parent, bounds: { x: 10, y: 50, width: 200, height: 999 } },
    height: 44,
    scroll: (delta: number) => scrolls.push(['upper', delta]),
  };
  const scrolls: [string, number][] = [];
  const api: any = {
    cls: (name: string) =>
      name === 'openfl.geom.Point'
        ? class Point {
            constructor(
              public x: number,
              public y: number,
            ) {}
          }
        : {
            globalRect: (node: any) => ({ ...node.bounds }),
            toCss: (bounds: any) => ({
              x: 30 + bounds.x * 2,
              y: 40 + bounds.y * 2,
              width: bounds.width * 2,
              height: bounds.height * 2,
            }),
          },
  };
  let consumed = 0;
  const event = (x: number, y: number, deltaY = 10) => ({
    clientX: x,
    clientY: y,
    deltaY,
    preventDefault() {
      consumed++;
    },
    stopImmediatePropagation() {
      consumed++;
    },
  });
  hit = { parent: lower.node };
  assert.equal(routeAutocompleteWheel(api, [lower, upper], event(70, 260)), true);
  assert.deepEqual({ ...lastPoint }, { x: 20, y: 110 });
  assert.deepEqual(scrolls, [['lower', 10]]);
  hit = { parent: upper.node };
  assert.equal(
    routeAutocompleteWheel(api, [lower, upper], event(70, 160, -10)),
    true,
    'argument help remains independently addressable',
  );
  assert.deepEqual(scrolls[1], ['upper', -10]);
  hit = { parent: { name: 'covering window' } };
  assert.equal(routeAutocompleteWheel(api, [lower, upper], event(70, 260)), false);
  hit = { parent: lower.node };
  assert.equal(routeAutocompleteWheel(api, [lower], event(70, 260, 0)), false);
  assert.equal(
    routeAutocompleteWheel(api, [lower], event(450, 260)),
    false,
    'right edge is exclusive',
  );
  assert.equal(
    routeAutocompleteWheel(api, [lower], event(70, 396)),
    false,
    'bottom edge is exclusive',
  );
  parent.visible = false;
  assert.equal(routeAutocompleteWheel(api, [lower], event(70, 260)), false);
  parent.visible = true;
  parent.alpha = 0;
  assert.equal(routeAutocompleteWheel(api, [lower], event(70, 260)), false);
  assert.equal(consumed, 4);
});
