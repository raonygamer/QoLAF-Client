import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installPaintShop, paintRanges } from '../src/ship/PaintShop';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('original paint mode ranges preserve hue limits and extreme signed integer bounds', () => {
  assert.deepEqual(paintRanges('Extended').slice(1, 4), [
    { minimum: -1.18, maximum: 1.04 },
    { minimum: -3, maximum: 15 },
    { minimum: -4, maximum: 8 },
  ]);
  assert.ok(paintRanges('Un-Paint').every((range) => range.minimum === 0 && range.maximum === 0));
  assert.ok(
    paintRanges('Extreme')
      .slice(1, 4)
      .every((range) => range.minimum === -2147483648 && range.maximum === 2147483647),
  );
});

test('paint controls rebuild modes and test drive captures values without a purchase', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  class Display {
    removed = false;
    set_x() {}
    set_y() {}
    set_touchable() {}
    set_wordWrap() {}
    set_autoScale() {}
    set_pixelSnapping() {}
    removeFromParent() {
      this.removed = true;
    }
  }
  class Button extends Display {
    constructor(
      public callback: () => void,
      public text: string,
    ) {
      super();
    }
  }
  class Filter {
    values: number[] = [];
    set_resolution() {}
    adjustHue(v: number) {
      this.values[0] = v;
    }
    adjustBrightness(v: number) {
      this.values[1] = v;
    }
    adjustSaturation(v: number) {
      this.values[2] = v;
    }
    adjustContrast(v: number) {
      this.values[3] = v;
    }
  }
  class Slider {
    minimum = -5;
    maximum = 20;
    value = 0;
    get_value() {
      return this.value;
    }
    set_value(v: number) {
      this.value = Math.max(this.minimum, Math.min(this.maximum, v));
    }
  }
  const clip = {
    filter: new Filter(),
    set_filter(value: Filter) {
      this.filter = value;
    },
  };
  const player = {
    ship: { engine: { colorHue: 0 }, originalFilter: new Filter(), get_movieClip: () => clip },
  };
  let transitioned: Screen | undefined,
    roaming = 0;
  const game = {
    get_isLeaving: () => false,
    get_me: () => player,
    fadeIntoState(state: Screen) {
      transitioned = state;
    },
    enterState() {
      roaming++;
    },
  };
  class Screen {
    body = {};
    preview = { get_movieClip: () => clip };
    emitters = [{ changeHue(_v: number) {} }];
    sliderShipHue = new Slider();
    sliderShipBrightness = new Slider();
    sliderShipSaturation = new Slider();
    sliderShipContrast = new Slider();
    sliderEngineHue = new Slider();
    children: Display[] = [];
    left = false;
    constructor(
      public g = game,
      _body?: object,
    ) {}
    addChild(child: Display) {
      this.children.push(child);
    }
    enter() {}
    exit() {}
    leave() {
      this.left = true;
    }
  }
  class Factory {
    static createPlayer(_game: object, _player: object, ship: typeof player.ship) {
      return ship;
    }
  }
  const classes: Record<string, unknown> = {
    'core.states.gameStates.LandedPaintShop': Screen,
    'core.hud.components.Button': Button,
    'starling.text.TextField': Display,
    'starling.text.TextFormat': class {},
    'starling.filters.ColorMatrixFilter': Filter,
    'core.ship.ShipFactory': Factory,
    'core.states.gameStates.RoamingState': class {},
  };
  const cleanup: Array<() => void> = [],
    hooks = new Hooks((error: unknown) => {
      throw error;
    });
  const api = {
    cls: (name: string) => classes[name] ?? {},
    defer: (off: () => void) => cleanup.push(off),
    after(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'after', callback);
      cleanup.push(off);
      return off;
    },
    before(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'before', callback);
      cleanup.push(off);
      return off;
    },
  } as unknown as API;
  bindGameClasses(api);
  installPaintShop(api);
  try {
    const screen = new Screen();
    screen.enter();
    const button = (state: Screen, text: string) =>
      state.children.find((child) => child instanceof Button && child.text === text) as Button;
    button(screen, 'Extended').callback();
    t.mock.timers.tick(100);
    assert.ok(transitioned);
    screen.exit();
    transitioned.enter();
    assert.equal(transitioned.sliderShipSaturation.maximum, 15);
    transitioned.sliderShipHue.value = 1;
    transitioned.sliderShipBrightness.value = 0.5;
    transitioned.sliderEngineHue.value = 2;
    button(transitioned, 'Free Test Drive').callback();
    assert.equal(transitioned.left, true);
    assert.equal(roaming, 1);
    Factory.createPlayer(game, player, player.ship);
    assert.equal(player.ship.engine.colorHue, 2);
    transitioned.sliderShipHue.value = 0;
    t.mock.timers.tick(1000);
    assert.equal(player.ship.originalFilter.values[0], 1);
    assert.equal(player.ship.originalFilter.values[1], 0.5);
    // A later plugin's limit must survive our unload.
    transitioned.sliderShipHue.maximum = 42;
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
  assert.ok(transitioned);
  assert.equal(transitioned.sliderShipSaturation.minimum, -5);
  assert.equal(transitioned.sliderShipSaturation.maximum, 20);
  assert.equal(transitioned.sliderShipHue.maximum, 42);
  assert.ok(transitioned.children.every((child) => child.removed));
  const appliedFilter = player.ship.originalFilter;
  t.mock.timers.tick(5000);
  assert.equal(
    player.ship.originalFilter,
    appliedFilter,
    'unload cancels the second delayed application',
  );
});
