import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installBodyMissionHints } from '../src/world/BodyMissionHints';
// @ts-expect-error production hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('mission markers retain native data and restore their font on unload', () => {
  class Field {
    disposals = 0;
    detached = false;
    removeFromParent() {
      this.detached = true;
    }
    dispose() {
      this.disposals++;
    }
    font = 'DAIDRR';
    snapping = false;
    color = 16746564;
    size = 100;
    text = '?';
    get_format() {
      if (this.disposals) throw Error('disposed marker accessed');
      return {
        get_font: () => this.font,
        set_font: (font: string) => {
          this.font = font;
        },
      };
    }
    get_pixelSnapping() {
      return this.snapping;
    }
    set_pixelSnapping(value: boolean) {
      this.snapping = value;
    }
  }
  class Body {
    hintTween: { kill(): void } | null = null;
    reset() {
      this.hintTween?.kill();
    }
    canTriggerMission = true;
    missionHint: Field | null = new Field();
    draws = 0;
    preDraw() {
      this.draws++;
    }
  }
  const hooks = new Hooks((error: unknown) => {
    throw error;
  });
  const cleanups: Array<() => void> = [];
  const api = {
    cls: (name: string) => (name === 'core.solarSystem.Body' ? Body : {}),
    before(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'before', callback);
      cleanups.push(off);
      return off;
    },
    after(owner: object, method: string, callback: unknown) {
      const off = hooks.add(owner, method, 'after', callback);
      cleanups.push(off);
      return off;
    },
    defer: (off: () => void) => cleanups.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installBodyMissionHints(api);
  const body = new Body();
  const marker = body.missionHint!;
  const other = new Body();
  try {
    body.preDraw();
    body.preDraw();
    assert.equal(body.draws, 2);
    assert.equal(marker.font, 'DAIDRR_COMBAT');
    assert.equal(marker.snapping, true);
    assert.deepEqual([marker.color, marker.size, marker.text], [16746564, 100, '?']);
    other.canTriggerMission = false;
    other.preDraw();
    assert.equal(other.missionHint!.font, 'DAIDRR');
    other.canTriggerMission = true;
    other.preDraw();
    other.missionHint!.font = 'another-plugin';
    const retired = new Body();
    const retiredMarker = retired.missionHint!;
    let kills = 0;
    retired.hintTween = {
      kill() {
        kills++;
      },
    };
    retired.preDraw();
    retired.reset();
    retired.reset();
    assert.equal(kills, 1);
    assert.equal(retired.missionHint, null);
    assert.equal(retired.hintTween, null);
    assert.equal(retiredMarker.detached, true);
    assert.equal(retiredMarker.disposals, 1);
    const missing = new Body();
    missing.missionHint = null;
    missing.preDraw();
    assert.equal(missing.draws, 1);
  } finally {
    cleanups.reverse().forEach((off) => off());
  }
  assert.equal(marker.font, 'DAIDRR');
  assert.equal(marker.snapping, false);
  assert.equal(other.missionHint!.font, 'another-plugin');
  body.preDraw();
  assert.equal(marker.font, 'DAIDRR');
});
