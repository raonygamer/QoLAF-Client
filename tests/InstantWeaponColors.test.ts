import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installInstantWeaponColors } from '../src/visuals/InstantWeaponColors';
// @ts-expect-error extracted native methods
import { InstantPrototype, InstantSplittingPrototype } from './fixtures/NativeInstant.js';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

function fixture(splitting: boolean) {
  const hooks = new Hooks();
  const cleanup: Function[] = [];
  class Line {
    args: any[] = [];
    init(...args: any[]) {
      this.args = args;
    }
    set_visible() {}
  }
  const pool: Line[] = [];
  const game: any = {
    beamLinePool: { getLine: () => pool.shift() ?? new Line() },
    canvasEffects: { addChild() {} },
  };
  class Projectile {
    weapon = { key: 'custom' };
    reset() {}
  }
  function State() {}
  State.prototype = { ...(splitting ? InstantSplittingPrototype : InstantPrototype) };
  const classes: any = {
    'core.hud.components.BeamLine': Line,
    'core.projectile.Projectile': Projectile,
    ['core.states.aistates.' + (splitting ? 'InstantSplitting' : 'Instant')]: State,
  };
  const api: any = {
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanup.push(fn),
  };
  for (const type of ['before', 'around'])
    api[type] = (target: any, method: string, fn: Function) =>
      cleanup.push(hooks.add(target, method, type, fn));
  const selected = { color: 0x1122ff, grayscale: true };
  const colorOf = installInstantWeaponColors(api, game, (weapon) =>
    weapon?.key === 'custom' ? selected : null,
  );
  const p: any = new Projectile();
  const state: any = Object.assign(Object.create(State.prototype), {
    p,
    g: game,
    lines: [],
    thickness: 4,
    frequency: 1,
    amplitude: 0,
    color: 0xabcdef,
    glowColor: 0x123456,
    alpha: 0.8,
    texture: 'line2',
  });
  return {
    state,
    p,
    pool,
    colorOf,
    selected,
    Line,
    dispose: () => cleanup.reverse().forEach((fn) => fn()),
  };
}

for (const splitting of [false, true]) {
  test(`${splitting ? 'splitting' : 'instant'} native enter applies chosen core/glow tint and clears pooled ownership`, () => {
    const { state, p, pool, colorOf, selected, Line, dispose } = fixture(splitting);
    state.enter();
    const lines = splitting ? [...state.lines] : [state.lineInner, state.lineOuter];
    for (const line of lines) {
      assert.equal(line.args[3], selected.color);
      assert.equal(line.args[6], selected.color);
      assert.equal(colorOf(line)?.grayscale, true);
    }
    assert.equal(p.determinedColor, selected.color);
    assert.equal(p.determinedGrayscale, true);
    const unrelated = new Line();
    unrelated.init(1, 1, 0, 0xaabbcc, 1, 3, 0xff0000);
    assert.equal(unrelated.args[3], 0xaabbcc);
    assert.equal(colorOf(unrelated), undefined);
    p.reset();
    assert.equal(Object.hasOwn(p, 'determinedColor'), false);
    assert.equal(Object.hasOwn(p, 'determinedGrayscale'), false);
    pool.push(...lines);
    state.lines = [];
    p.weapon.key = 'vanilla';
    state.enter();
    const reused = splitting ? state.lines[0] : state.lineOuter;
    assert.equal(reused.args[3], state.color);
    assert.equal(reused.args[6], state.glowColor);
    assert.equal(colorOf(reused), undefined);
    dispose();
  });
}

test('instant tint retains preexisting projectile fields and ignores other rooms', () => {
  const { state, p, colorOf, dispose } = fixture(false);
  p.determinedColor = 0x42;
  p.determinedGrayscale = false;
  state.enter();
  p.reset();
  assert.equal(p.determinedColor, 0x42);
  assert.equal(p.determinedGrayscale, false);
  const originalGame = state.g;
  state.g = { ...originalGame };
  state.enter();
  assert.equal(colorOf(state.lineOuter), undefined);
  assert.equal(state.lineOuter.args[3], state.color);
  state.g = originalGame;
  state.enter();
  dispose();
  assert.equal(p.determinedColor, 0x42);
  assert.equal(p.determinedGrayscale, false);
});
