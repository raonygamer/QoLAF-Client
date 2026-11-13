import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { createSettingsChat } from '../src/ported/SettingsChat';
import { aliasProperties } from '../src/runtime/HaxeInterop';
import { Display } from './fixtures/NativeGame';

test('chat settings expose original controls and bind every mute channel independently', (t) => {
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
    minimum = 0;
    maximum = 1;
    step = 0;
    value = 0;
  }
  class Text extends Display {
    text = '';
    htmlText = '';
  }
  class Label extends Display {
    constructor(
      readonly width: number,
      readonly height: number,
      readonly text: string,
    ) {
      super();
    }
  }
  const settings = { enableNewChatIntegrationSystem: true, legacyChatFontSize: 14 };
  const muted = new Set(['global']);
  const changes: Array<[string, boolean]> = [];
  const game = {
    messageLog: {
      isMuted: (channel: string) => muted.has(channel),
      toggleMuted: (channel: string, value: boolean) => changes.push([channel, value]),
    },
  };
  const definitions: Record<string, unknown> = {
    'core.scene.SceneBase': { settings },
    'core.hud.components.Text': Text,
    'core.text.RussoBitmapFontRegistry': { fontNameForSize: () => 'DAIDRR_16' },
    'feathers.controls.Check': Check,
    'feathers.controls.Slider': Slider,
    'feathers.controls.ScrollContainer': Display,
    'starling.display.Sprite': Display,
    'starling.text.TextField': Label,
    'starling.text.TextFormat': class {},
    'generics.Localize': { t: (value: string) => 'translated:' + value },
  };
  const Page = createSettingsChat((name) => definitions[name]);
  const page = new Page(game);
  const scroll = page.getChildAt(0) as Display;
  const checks = scroll.children.filter((child): child is Check => child instanceof Check);
  assert.equal(checks.length, 11);
  assert.equal(checks[0].isSelected, true);
  checks[0].isSelected = false;
  checks[0].dispatchEventWith('change');
  assert.equal(settings.enableNewChatIntegrationSystem, false);
  const slider = scroll.children.find((child): child is Slider => child instanceof Slider)!;
  assert.deepEqual([slider.minimum, slider.maximum, slider.step, slider.value], [12, 24, 1, 14]);
  slider.value = 19.6;
  slider.dispatchEventWith('change');
  assert.equal(settings.legacyChatFontSize, 20);
  assert.ok(scroll.children.some((child) => child instanceof Text && child.text === '20px'));
  const channels = [
    'system',
    'local',
    'global',
    'clan',
    'group',
    'private',
    'planetwars',
    'join_leave',
    'death',
    'loot',
  ];
  for (const [index, channel] of channels.entries()) {
    const check = checks[index + 1];
    assert.equal(check.isSelected, !muted.has(channel));
    check.isSelected = !check.isSelected;
    check.dispatchEventWith('change');
  }
  assert.deepEqual(
    changes,
    channels.map((channel) => [channel, !muted.has(channel)]),
  );
  const labels = scroll.children.filter((child): child is Label => child instanceof Label);
  assert.equal(labels[0].text, 'translated:Enable the new chat integration system');
  assert.deepEqual(
    labels.slice(1).map((label) => label.text),
    [
      'System',
      'Local',
      'Global',
      'Clan',
      'Group',
      'Private',
      'Planet wars',
      'Player join/leave',
      'Player death',
      'Loot found',
    ].map((text) => 'translated:' + text),
  );
  page.dispose();
});
