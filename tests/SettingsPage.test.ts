import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsQoLAF } from '../src/ported/SettingsQoLAF';
import { createClientSettings } from '../src/ported/ClientSettings';
import { Display } from './fixtures/NativeGame';
import { aliasProperties } from '../src/runtime/HaxeInterop';

// Exercise the original page's controls/callbacks through real Starling event
// invocation. This checks source behavior and teardown, not visual rendering.
test('original Aim Assist page updates source settings and removes every owned listener', () => {
  const cleanup: Function[] = [];
  aliasProperties({ defer: (fn: Function) => cleanup.push(fn) } as any, Display);
  class Control extends Display {
    isSelected = false;
    value = 0;
    minimum = 0;
    maximum = 1;
    step = 0;
  }
  class Label extends Display {
    constructor(x = 0, y = 0) {
      super();
      this.set_x(x);
      this.set_y(y);
    }
    text = '';
  }
  class Point {
    constructor(
      public x = 0,
      public y = 0,
    ) {}
  }
  const scene: any = {};
  let debugUpdates = 0;
  const game: any = {
    me: { id: 'p1' },
    gameStateMachine: {
      currentState: {
        applyAimAssistDebugVisibility() {
          debugUpdates++;
        },
      },
    },
  };
  const definitions: any = {
    'core.scene.Game': { instance: game },
    'core.scene.SceneBase': scene,
    'openfl.geom.Point': Point,
    'openfl.net.SharedObject': { getLocal: () => ({ data: {}, flush() {} }) },
    'core.hud.components.Text': Label,
    'core.states.gameStates.PlayState': Display,
    'feathers.controls.Check': Control,
    'feathers.controls.Slider': Control,
    'feathers.controls.ScrollContainer': Display,
    'starling.display.Sprite': Display,
    'starling.events.Event': { CHANGE: 'change' },
    'generics.Localize': { t: (s: string) => s },
  };
  const resolve = (key: string) => {
    assert.ok(definitions[key], key);
    return definitions[key];
  };
  const ClientSettings = createClientSettings(resolve);
  definitions['qolaf.data.ClientSettings'] = ClientSettings;
  scene.clientSettings = new ClientSettings();
  const Page = createSettingsQoLAF(resolve);
  const page = new Page(game, 'aim');
  const toggles = page.aimAssistToggleBindings,
    sliders = page.aimAssistSliderBindings;
  assert.ok(toggles.length > 3);
  assert.ok(sliders.length > 10);
  const toggle = toggles[0];
  toggle.control.isSelected = !scene.clientSettings.getAimAssistBoolean(toggle.key);
  toggle.control.dispatchEventWith('change');
  assert.equal(scene.clientSettings.getAimAssistBoolean(toggle.key), toggle.control.isSelected);
  const debugToggle = toggles.find(
    (binding: any) => binding.key === ClientSettings.AIM_ASSIST_DEBUG,
  );
  debugToggle.control.isSelected = true;
  debugToggle.control.dispatchEventWith('change');
  assert.equal(debugUpdates, 1, 'debug toggle addresses the native currentState');
  const slider = sliders[0];
  slider.control.value = ClientSettings.getAimAssistNumberMaximum(slider.key);
  slider.control.dispatchEventWith('change');
  assert.equal(scene.clientSettings.getAimAssistNumber(slider.key), slider.control.value);
  const controls = [...toggles, ...sliders].map((binding) => binding.control);
  assert.ok(controls.every((control) => control.listeners('change').length === 1));
  page.dispose();
  assert.ok(controls.every((control) => control.listeners('change').length === 0));
  cleanup.reverse().forEach((fn) => fn());
});

test('settings slider retains upstream drag behavior with original skin geometry', async () => {
  const { settingsControls } = await import('../src/settings/NativeControls');
  const { Quad } = await import('./fixtures/NativeGame');
  // @ts-expect-error extracted upstream JavaScript
  const { default: makeSlider } = await import('./fixtures/UpstreamSlider.js');
  function NativeSprite(this: any) {
    Object.assign(this, new Display());
  }
  NativeSprite.prototype = Object.create(Display.prototype);
  const NativeSlider = makeSlider(NativeSprite, Quad, {
    sliderTrack: () => new Quad(152, 4),
    sliderThumb: () => new Quad(13, 13),
  });
  const defs: any = {
    'core.hud.components.ui.CheckBox': Display,
    'core.hud.components.ui.Slider': NativeSlider,
    'core.hud.components.ui.ScrollBox': Display,
    'starling.display.Sprite': Display,
    'starling.display.Quad': Quad,
  };
  const Slider = settingsControls((name) => defs[name])['feathers.controls.Slider'];
  const slider = new Slider();
  slider.minimum = 0;
  slider.maximum = 100;
  slider.step = 5;
  slider.set_width(200);
  assert.equal(slider.get_height(), 14);
  assert.equal(slider.getThumb().get_width(), 10);
  assert.equal(slider.getTrack().get_height(), 4);
  let changes = 0;
  slider.addEventListener('change', () => changes++);
  const touch = (phase: string, x: number) =>
    slider.onTouch({
      getTouch: () => ({ get_phase: () => phase, getLocation: () => ({ x, y: 0 }) }),
    });
  touch('began', 79);
  assert.equal(slider.get_value(), 40);
  assert.equal(changes, 1);
  assert.equal(slider.getThumb().get_x(), 75);
  assert.equal(slider.getThumb().getChildAt(1).get_color(), 0x505050);
  const oldThumb = slider.getThumb();
  touch('ended', 79);
  assert.equal(oldThumb.disposed, false);
  assert.equal(slider.getThumb(), oldThumb, 'source defaultSkin is reused for every state');
  assert.equal(slider.getThumb().getChildAt(1).get_color(), 0x505050);
  slider.isEnabled = false;
  assert.equal(slider.touchable, false);
  assert.equal(slider.getThumb().getChildAt(1).get_color(), 0x505050);
  slider.setThumbState('hover');
  assert.equal(slider.getThumb().getChildAt(1).get_color(), 0x505050);
  slider.isEnabled = true;
  assert.equal(slider.touchable, true);
  assert.equal(slider.getThumb().getChildAt(1).get_color(), 0x505050);
  const children = slider.children.slice();
  slider.dispose();
  assert.ok(children.every((child: any) => child.disposed));
});
