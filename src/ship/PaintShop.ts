import type { API } from '../api/Types';
import {
  LandedPaintShop,
  PaintButton,
  ColorMatrixFilter,
  RoamingState,
  ShipFactory,
  type Player,
  type GameScene,
  type DisplayObject,
} from '../game/Bindings';
import { NativeUI } from '../ui/NativeUI';

export type PaintMode = 'Original' | 'Extended' | 'Extreme' | 'Un-Paint';
interface Range {
  minimum: number;
  maximum: number;
}
export function paintRanges(mode: PaintMode): Range[] {
  if (mode === 'Un-Paint') return Array.from({ length: 5 }, () => ({ minimum: 0, maximum: 0 }));
  const ship =
    mode === 'Extreme'
      ? Array.from({ length: 3 }, () => ({ minimum: -2147483648, maximum: 2147483647 }))
      : mode === 'Extended'
        ? [
            { minimum: -1.18, maximum: 1.04 },
            { minimum: -3, maximum: 15 },
            { minimum: -4, maximum: 8 },
          ]
        : [
            { minimum: -0.18, maximum: 0.04 },
            { minimum: -1, maximum: 1 },
            { minimum: 0, maximum: 1 },
          ];
  return [{ minimum: 0, maximum: Math.PI / 2 + 0.3 }, ...ship, { minimum: 0, maximum: Math.PI }];
}

/** Original paint modes and local test drive, on the current game's paint screen. */
export function installPaintShop(api: API): void {
  const ui = new NativeUI(api);
  const engineOverrides = new WeakMap<Player, number>();
  api.after(ShipFactory, 'createPlayer', function (ship, _game, player) {
    const hue = engineOverrides.get(player);
    if (hue !== undefined && hue !== 0 && ship.engine) {
      ship.engine.colorHue = hue;
      engineOverrides.delete(player);
    }
  });
  const modes = new WeakMap<GameScene, PaintMode>();
  const controls = new Map<LandedPaintShop, DisplayObject[]>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (delay: number, callback: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };
  const sliders = (state: LandedPaintShop) => [
    state.sliderShipHue,
    state.sliderShipBrightness,
    state.sliderShipSaturation,
    state.sliderShipContrast,
    state.sliderEngineHue,
  ];
  const rangeChanges = new Map<
    LandedPaintShop,
    Array<{ slider: ReturnType<typeof sliders>[number]; original: Range; applied: Range }>
  >();
  const filterFor = (values: number[]) => {
    const filter = new ColorMatrixFilter();
    filter.set_resolution(2);
    filter.adjustHue(values[0]);
    filter.adjustBrightness(values[1]);
    filter.adjustSaturation(values[2]);
    filter.adjustContrast(values[3]);
    return filter;
  };
  const remove = (state: LandedPaintShop) => {
    for (const control of controls.get(state) ?? []) control.removeFromParent(true);
    controls.delete(state);
    rangeChanges.delete(state);
  };
  api.after(LandedPaintShop.prototype, 'enter', function () {
    remove(this);
    const state = this,
      game = this.g;
    const mode = modes.get(game) ?? 'Original';
    const ranges = paintRanges(mode);
    rangeChanges.set(
      state,
      sliders(state).map((slider, index) => ({
        slider,
        original: { minimum: slider.minimum, maximum: slider.maximum },
        applied: ranges[index],
      })),
    );
    sliders(state).forEach((slider, index) => {
      Object.assign(slider, ranges[index]);
      slider.set_value(slider.get_value());
    });
    state.preview
      .get_movieClip()
      ?.set_filter(filterFor(sliders(state).map((slider) => slider.get_value())));
    for (const emitter of state.emitters) emitter.changeHue(state.sliderEngineHue.get_value());
    const owned: DisplayObject[] = [];
    controls.set(state, owned);
    const label = ui.text(300, 32, mode, 23, 16515901);
    label.set_x(200);
    label.set_y(100);
    state.addChild(label);
    owned.push(label);
    const add = (text: string, x: number, y: number, callback: () => void, style = 'highlight') => {
      const button = new PaintButton(callback, text, style);
      button.set_x(x);
      button.set_y(y);
      state.addChild(button);
      owned.push(button);
    };
    (['Extended', 'Extreme', 'Un-Paint', 'Original'] as const).forEach((value, index) => {
      add(value, 200 + index * 100, 390, () => {
        modes.set(game, value);
        later(100, () => {
          if (controls.has(state) && !game.get_isLeaving())
            game.fadeIntoState(new LandedPaintShop(game, state.body));
        });
      });
    });
    add(
      'Free Test Drive',
      270,
      485,
      () => {
        const values = sliders(state).map((slider) => slider.get_value());
        const player = game.get_me();
        if (!player) return;
        engineOverrides.set(player, values[4]);
        state.leave();
        game.enterState(new RoamingState(game));
        const apply = () => {
          if (game.get_isLeaving() || game.get_me() !== player || !player.ship) return;
          const filter = filterFor(values);
          player.ship.get_movieClip()?.set_filter(filter);
          player.ship.originalFilter = filter;
        };
        later(1000, apply);
        later(2000, apply);
      },
      'positive',
    );
  });
  api.before(LandedPaintShop.prototype, 'exit', function () {
    remove(this);
  });
  api.defer(() => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const changes of rangeChanges.values()) {
      for (const { slider, original, applied } of changes) {
        // Another plugin may have taken ownership of either bound since enter.
        if (slider.minimum !== applied.minimum || slider.maximum !== applied.maximum) continue;
        Object.assign(slider, original);
        slider.set_value(slider.get_value());
      }
    }
    for (const state of controls.keys()) remove(state);
  });
}
