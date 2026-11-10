import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
// @ts-expect-error original AS3 method execution fixture
import { install } from './Fixtures/As3Methods.js';
import { createClientDeveloperTagColor } from '../src/Ported/ClientDeveloperTagColor';
import { createEchoPulseColor } from '../src/Ported/EchoPulseColor';
import { createRoomInvitePulseColor } from '../src/Ported/RoomInvitePulseColor';
import { createPodRewardPulseColor } from '../src/Ported/PodRewardPulseColor';

for (const [name, factory] of Object.entries({
  ClientDeveloperTagColor: createClientDeveloperTagColor,
  EchoPulseColor: createEchoPulseColor,
  RoomInvitePulseColor: createRoomInvitePulseColor,
  PodRewardPulseColor: createPodRewardPulseColor,
})) {
  test(`${name} matches original AS3 colors and never advances simulation time`, () => {
    let now = 0;
    let leaving = false;
    const nativeGame = {
      time: 33,
      clock: { getServerTime: () => now },
      get_isLeaving: () => leaving,
    };
    const Game = { instance: nativeGame as any };
    const originalGame = {
      get time() {
        return nativeGame.time;
      },
      get networkServerTime() {
        return now;
      },
      get isLeaving() {
        return leaving;
      },
    };
    const source = readFileSync(new URL(`./Fixtures/Colors/${name}.as`, import.meta.url), 'utf8');
    const scope: any = {
      Game: { instance: originalGame },
      uint: (v: number) => v >>> 0,
      int: (v: number) => v | 0,
    };
    for (const match of source.matchAll(
      /(?:public|private) static (?:const|var) (\w+):(?:Number|uint)\s*=\s*([^;]+);/g,
    )) {
      scope[match[1]] = new Function('scope', `with(scope) { return ${match[2]}; }`)(scope);
    }
    install(
      scope,
      source,
      name === 'PodRewardPulseColor'
        ? ['colorAt', 'sampleColors', 'currentColor', 'currentLowRelicColor']
        : ['currentColor'],
    );
    const Color = factory(() => Game);
    for (let index = 0; index < 10000; index++) {
      now = index * 17.137;
      assert.equal(Color.currentColor, scope.currentColor(), `time ${now}`);
      assert.equal(Color.currentColor, scope.currentColor(), 'cached sample');
      if (name === 'PodRewardPulseColor')
        assert.equal(Color.currentLowRelicColor, scope.currentLowRelicColor());
      assert.equal(nativeGame.time, 33);
    }
    for (const invalid of [0, -1, NaN, Infinity]) {
      now = invalid;
      assert.equal(Color.currentColor, scope.currentColor());
    }
    leaving = true;
    assert.equal(Color.currentColor, scope.currentColor());
    Game.instance = null;
    scope.Game.instance = null;
    assert.equal(Color.currentColor, scope.currentColor());
  });
}
