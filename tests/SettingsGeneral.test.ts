import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { createSettingsGeneral } from '../src/ported/SettingsGeneral';
import { aliasProperties } from '../src/runtime/HaxeInterop';
import { Display } from './fixtures/NativeGame';

test('all general settings categories route toggles and sliders to their source properties', (t) => {
  const cleanups: Array<() => void> = [];
  aliasProperties(
    { defer: (cleanup: () => void) => cleanups.push(cleanup) } as unknown as API,
    Display,
  );
  t.after(() => cleanups.reverse().forEach((cleanup) => cleanup()));
  class Check extends Display {
    isSelected = false;
  }
  class Slider extends Display {
    value = 0;
    minimum = 0;
    maximum = 1;
    step = 0;
  }
  class Text extends Display {
    text = '';
    htmlText = '';
  }
  const writes: string[] = [];
  const track = (prefix: string, values: Record<string, number | boolean>) =>
    new Proxy(values, {
      get: (target, key: string) => target[key] ?? false,
      set: (target, key: string, value: number | boolean) => {
        target[key] = value;
        writes.push(prefix + key);
        return true;
      },
    });
  const settings = track('settings.', { rotationSpeed: 1, renderFrameRate: 241, dpiScale: 1 });
  const clientSettings = track('client.', {});
  const effects: unknown[] = [];
  const game = {
    toggleHighGraphics: (enabled: boolean) => effects.push(['graphics', enabled]),
    parallaxManager: { refresh: () => effects.push(['background']) },
    projectileManager: {
      setTorpedoCueEnabled: (enabled: boolean) => effects.push(['rhythm', enabled]),
    },
  };
  const definitions: Record<string, unknown> = {
    RymdenRunt: { UNLIMITED_FRAME_RATE: 241, MIN_DPI_SCALE: 0.5, MAX_DPI_SCALE: 2 },
    'core.scene.SceneBase': { settings, clientSettings },
    'core.solarSystem.BodyManager': { DISTORTION_EFFECTS_AVAILABLE: true },
    'core.hud.components.Text': Text,
    'feathers.controls.Check': Check,
    'feathers.controls.Slider': Slider,
    'feathers.controls.ScrollContainer': Display,
    'starling.display.Sprite': Display,
    'generics.Localize': { t: (text: string) => text },
    'qolaf.states.SettingsQoLAF': Display,
  };
  const Page = createSettingsGeneral((name) => definitions[name]);
  const cases = [
    [
      'general',
      [
        'settings.mouseAim',
        'settings.fireWithHotkeys',
        'settings.disableSpaceToRespawn',
        'settings.iWantAllTimedMissions',
      ],
      ['settings.musicVolume', 'settings.effectVolume', 'settings.rotationSpeed'],
    ],
    ['graphics', ['settings.showEffects'], ['settings.renderFrameRate', 'settings.dpiScale']],
    [
      'cosmetics',
      [
        'settings.showBackground',
        'settings.showBlackHoleDistortion',
        'client.animateTeleportScaling',
        'client.disableRemasteredAuras',
      ],
      ['settings.backgroundOpacity', 'settings.starBrightness'],
    ],
    [
      'hud',
      [
        'settings.showHud',
        'client.showRadarFPS',
        'client.showRadarLatency',
        'client.showRadarDPS',
        'client.showRadarSpeed',
        'client.showRadarService',
        'client.showRadarXP',
        'client.showRadarCargo',
        'client.showRadarArts',
        'client.radarCountRecycledArts',
        'client.radarSpeedInMph',
        'client.showNexarFactionLabels',
        'client.showNexarEnemyNames',
        'client.showNexarHealthBars',
        'client.showNexarHealthValues',
        'settings.showLatency',
        'settings.formatDamageText',
        'settings.formatHealthAndShield',
        'settings.formatTargetBarValues',
        'settings.showPlayerClanIdentification',
        'settings.compactWarpGateUI',
      ],
      [],
    ],
    [
      'combat',
      [
        'client.showBossSpawnMarkers',
        'client.showMinibossSpawnHeatmap',
        'client.showXhersixTorpedoWarnings',
        'client.showXhersixTorpedoRhythm',
        'client.correctXhersixTorpedoPrediction',
        'client.showNetherBlobBeamCountdown',
      ],
      [],
    ],
  ] as const;
  for (const [category, toggleProperties, sliderProperties] of cases) {
    const page = new Page(game, category);
    const scroll = page.getChildAt(0) as Display;
    const checks = scroll.children.filter((child): child is Check => child instanceof Check);
    const sliders = scroll.children.filter((child): child is Slider => child instanceof Slider);
    assert.equal(checks.length, toggleProperties.length, category);
    assert.equal(sliders.length, sliderProperties.length, category);
    writes.length = 0;
    for (const check of checks) {
      check.isSelected = !check.isSelected;
      check.dispatchEventWith('change');
    }
    assert.deepEqual(writes.splice(0), [...toggleProperties], category);
    for (const slider of sliders) {
      slider.value = slider.maximum;
      slider.dispatchEventWith('change');
    }
    assert.deepEqual(writes.splice(0), [...sliderProperties], category);
    if (category === 'general') {
      assert.equal(settings.rotationSpeed, 1.25);
      assert.equal(settings.mouseAim, true, 'keyboard steering checkbox inverts mouse aim');
    }
    if (category === 'graphics') {
      assert.deepEqual(
        sliders.map((slider) => [slider.minimum, slider.maximum, slider.step]),
        [
          [30, 241, 1],
          [0.5, 2, 0.05],
        ],
      );
      assert.ok(
        scroll.children.some((child) => child instanceof Text && child.text === 'Unlimited'),
      );
      assert.ok(scroll.children.some((child) => child instanceof Text && child.text === '200%'));
    }
    page.dispose();
  }
  assert.deepEqual(effects, [['graphics', true], ['background'], ['rhythm', true]]);
});
