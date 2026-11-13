import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installNativeSoundChannels } from '../src/music/NativeSoundChannels';
// @ts-expect-error real host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('stop retires every overlapping channel and removes native completion listeners', (t) => {
  let elapsed = 1000;
  t.mock.method(performance, 'now', () => elapsed);
  class Channel extends EventTarget {
    stops = 0;
    volume = 0.4;
    start = 0;
    get_position() {
      return 1234;
    }
    get_soundTransform() {
      return { volume: this.volume };
    }
    stop() {
      this.stops++;
    }
  }
  let completions = 0;
  let fadesCancelled = 0;
  const tweens: Array<{ volume?: number; onComplete?: () => void }> = [];
  class Sound {
    soundChannels: Channel[] = [];
    sc: Channel | null = null;
    isPlaying = true;
    loop = true;
    position = 420;
    multipleAllowed = true;
    oldTime = 0;
    set_volume(volume: number) {
      if (this.sc) this.sc.volume = volume;
      return volume;
    }
    hx__closures__: Record<number, () => void> = {
      1: () => {
        completions++;
      },
      2: () => {
        completions++;
      },
    };
    playObject(_volume: number, loop = false) {
      this.loop = loop;
      this.isPlaying = true;
      const channel = new Channel();
      channel.addEventListener('soundComplete', this.hx__closures__[loop ? 1 : 2]);
      this.soundChannels.push(channel);
      this.sc = channel;
      return channel;
    }
    resume(volume: number, loop: boolean) {
      return this.playObject(volume, loop);
    }
    pause() {
      if (this.sc) this.position = this.sc.get_position();
      this.sc?.stop();
      this.isPlaying = false;
    }
    fadePlay(_position: number, _complete?: () => void) {}
    fadeStop(_complete?: () => void) {}
    get_originalVolume() {
      return 0.8;
    }
    restartSoundChannel() {}
    killSoundChannel() {}
    stop() {
      this.sc?.stop();
    }
  }
  Object.assign(Sound.prototype.restartSoundChannel, { __id__: 1 });
  Object.assign(Sound.prototype.killSoundChannel, { __id__: 2 });
  const nativeStop = Sound.prototype.stop;
  const cleanups: Array<() => void> = [];
  const hooks = new Hooks();
  let denyChannel = false;
  class BaseSound {
    play(_position: number, _loops: number, transform: { volume: number }) {
      if (denyChannel) return null;
      const channel = new Channel();
      channel.start = _position;
      channel.volume = transform.volume;
      return channel;
    }
  }
  class Transform {
    constructor(readonly volume: number) {}
  }
  const api = {
    defer: (cleanup: () => void) => cleanups.push(cleanup),
    cls: (name: string) =>
      name === 'openfl.media.Sound'
        ? BaseSound
        : name === 'openfl.media.SoundTransform'
          ? Transform
          : name === 'sound.SoundObject'
            ? Sound
            : name === 'com.greensock.TweenMax'
              ? {
                  killTweensOf: () => fadesCancelled++,
                  to: (
                    _sound: Sound,
                    duration: number,
                    options: { volume?: number; onComplete?: () => void },
                  ) => {
                    assert.equal(duration, 3);
                    tweens.push(options);
                  },
                }
              : name === 'sound.SoundLocator'
                ? { getService: () => ({ get_musicVolume: () => 0.5 }) }
                : class {},
    around: (owner: object, method: string, callback: (...args: never[]) => unknown) => {
      const remove = hooks.add(owner, method, 'around', callback);
      cleanups.push(remove);
      return remove;
    },
  } as unknown as API;
  bindGameClasses(api);
  installNativeSoundChannels(api);
  const sound = new Sound();
  const channels = [new Channel(), new Channel(), new Channel()];
  for (const channel of channels) {
    channel.addEventListener('soundComplete', sound.hx__closures__[1]);
    channel.addEventListener('soundComplete', sound.hx__closures__[2]);
  }
  // Include a current music channel absent from the native effects-only array.
  sound.soundChannels.push(channels[0], channels[1], channels[1]);
  sound.sc = channels[2];
  let surviving: Channel | undefined;
  const play = (loop: boolean) => {
    elapsed += 66;
    return sound.playObject(0.4, loop);
  };
  try {
    sound.stop();
    assert.deepEqual(
      channels.map((channel) => channel.stops),
      [1, 1, 1],
    );
    assert.equal(sound.sc, null);
    assert.equal(sound.soundChannels.length, 0);
    assert.equal(sound.isPlaying, false);
    assert.equal(sound.loop, false);
    assert.equal(sound.position, 0);
    assert.equal(fadesCancelled, 1);
    channels.forEach((channel) => channel.dispatchEvent(new Event('soundComplete')));
    assert.equal(completions, 0);
    sound.stop();
    assert.deepEqual(
      channels.map((channel) => channel.stops),
      [1, 1, 1],
    );
    const first = play(false);
    assert.equal(
      sound.playObject(0.4, false),
      null,
      'overlapping effects retain their 66 ms throttle',
    );
    const second = play(false);
    first.dispatchEvent(new Event('soundComplete'));
    assert.equal(sound.sc, second, 'older completion preserves the newest channel');
    assert.equal(sound.isPlaying, true);
    assert.equal(first.stops, 1);
    first.dispatchEvent(new Event('soundComplete'));
    assert.equal(first.stops, 1, 'stale completion is detached');
    second.dispatchEvent(new Event('soundComplete'));
    assert.equal(sound.sc, null);
    assert.equal(sound.isPlaying, false);
    const looping = play(true);
    const newer = play(false);
    looping.dispatchEvent(new Event('soundComplete'));
    assert.equal(sound.sc, newer, 'restarted older loop does not replace current ownership');
    assert.equal(sound.soundChannels.length, 2);
    assert.equal(looping.stops, 1);
    assert.equal(sound.soundChannels.includes(looping), false);
    sound.stop();
    const pausedFirst = play(true);
    const pausedSecond = play(false);
    sound.pause();
    assert.equal(pausedFirst.stops, 1);
    assert.equal(pausedSecond.stops, 1);
    assert.equal(sound.soundChannels.length, 0);
    pausedFirst.dispatchEvent(new Event('soundComplete'));
    assert.equal(sound.isPlaying, false);
    sound.multipleAllowed = false;
    denyChannel = true;
    assert.equal(sound.resume(0.4, false), null, 'failed resume cannot return a stopped channel');
    assert.equal(sound.isPlaying, false);
    denyChannel = false;
    surviving = sound.resume(0.4, false);
    assert.equal(surviving.start, 1234, 'resume uses saved position');
    assert.equal(surviving.volume, 0, 'resume fades in from silence');
    assert.equal(tweens.at(-1)?.volume, 0.4, 'resume uses requested volume');
    const reused = sound.playObject(0.7, true);
    assert.equal(reused, surviving, 'exclusive playback reuses its live channel');
    assert.equal(reused.volume, 0.7);
    assert.equal(sound.soundChannels.length, 1);
    assert.equal(sound.loop, true);
    sound.playObject(0.4, false);
    assert.deepEqual(sound.soundChannels, [surviving]);
    sound.stop();
    sound.oldTime = Date.now();
    surviving = sound.playObject(0.2, false);
    assert.ok(surviving, 'exclusive music starts even within the effects throttle window');
    assert.equal(surviving.volume, 0.2, 'requested transform is applied at channel creation');
    let completedFade = 0;
    sound.fadeStop(() => completedFade++);
    const obsolete = tweens.at(-1)!;
    sound.playObject(0.6, false);
    obsolete.onComplete?.();
    assert.equal(sound.isPlaying, true, 'cancelled fade cannot stop reused playback');
    assert.equal(completedFade, 0);
    sound.fadeStop(() => completedFade++);
    tweens.at(-1)?.onComplete?.();
    assert.equal(sound.isPlaying, false);
    assert.equal(completedFade, 1);
    sound.fadePlay(10, () => completedFade++);
    assert.equal(completedFade, 2, 'stopped, unpaused fadePlay completes without starting');
    surviving = sound.playObject(0.2, false);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  assert.equal(Sound.prototype.stop, nativeStop);
  surviving?.dispatchEvent(new Event('soundComplete'));
  assert.equal(completions, 1, 'unload restores native completion on surviving channels');
});
