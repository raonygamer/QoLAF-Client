import { SoundPlaybackClock } from './SoundPlaybackClock';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  Sound,
  SoundObject,
  SoundLocator,
  SoundTransform,
  TweenMax,
  type SoundChannel,
} from '../game/Bindings';

interface ChannelOwner {
  sound: SoundObject;
  loop: boolean;
  complete: () => void;
}

/** Each completion owns its channel, never whichever channel most recently played. */
export function installNativeSoundChannels(api: API): void {
  const reflection = new GameReflection(api);
  const playbackClock = new SoundPlaybackClock();
  const paused = new Map<SoundObject, SoundChannel>();
  const generations = new WeakMap<SoundObject, number>();
  const fading = new Map<SoundObject, { volume: number; stop: boolean }>();
  const cancelFade = (sound: SoundObject) => {
    generations.set(sound, (generations.get(sound) ?? 0) + 1);
    fading.delete(sound);
    TweenMax.killTweensOf(sound);
  };
  const originalRestart = SoundObject.prototype.restartSoundChannel;
  const originalComplete = SoundObject.prototype.killSoundChannel;
  const owners = new Map<SoundChannel, ChannelOwner>();
  const detachNative = (sound: SoundObject, channel: SoundChannel) => {
    channel.removeEventListener('soundComplete', reflection.bound(sound, originalRestart));
    channel.removeEventListener('soundComplete', reflection.bound(sound, originalComplete));
  };
  const detach = (sound: SoundObject, channel: SoundChannel) => {
    detachNative(sound, channel);
    const owner = owners.get(channel);
    if (owner) channel.removeEventListener('soundComplete', owner.complete);
    owners.delete(channel);
  };
  const release = (sound: SoundObject, channel: SoundChannel) => {
    if (!sound.soundChannels.includes(channel) && sound.sc !== channel) return false;
    detach(sound, channel);
    sound.soundChannels = sound.soundChannels.filter((candidate) => candidate !== channel);
    if (sound.sc === channel) sound.sc = sound.soundChannels.at(-1) ?? null;
    sound.isPlaying = sound.soundChannels.length > 0 || sound.sc !== null;
    channel.stop();
    return true;
  };
  const track = (sound: SoundObject, channel: SoundChannel, loop: boolean) => {
    detach(sound, channel);
    if (!sound.soundChannels.includes(channel)) sound.soundChannels.push(channel);
    const complete = () => {
      const current = sound.sc;
      const volume = channel.get_soundTransform().volume;
      if (!release(sound, channel)) return;
      if (loop) {
        const replacement = Sound.prototype.play.call(sound, 0, 0, new SoundTransform(volume));
        if (replacement) {
          sound.sc = replacement;
          sound.isPlaying = true;
          track(sound, replacement, true);
          // An older overlapping loop must not take ownership from newer audio.
          if (current && current !== channel && sound.soundChannels.includes(current))
            sound.sc = current;
        }
      }
      if (!sound.isPlaying) {
        sound.loop = false;
        sound.position = 0;
        cancelFade(sound);
      }
    };
    owners.set(channel, { sound, loop, complete });
    channel.addEventListener('soundComplete', complete);
  };
  const startFade = (
    sound: SoundObject,
    position: number,
    volume: number,
    complete?: (() => void) | null,
  ) => {
    const channel = Sound.prototype.play.call(sound, position, 0, new SoundTransform(0));
    if (!channel) {
      complete?.();
      return;
    }
    sound.sc = channel;
    sound.isPlaying = true;
    sound._volume = 0;
    paused.delete(sound);
    track(sound, channel, sound.loop);
    const generation = generations.get(sound);
    fading.set(sound, { volume, stop: false });
    TweenMax.to(sound, 3, {
      volume,
      onComplete: () => {
        if (generations.get(sound) !== generation) return;
        fading.delete(sound);
        complete?.();
      },
    });
  };
  reflection.around(SoundObject.prototype, 'fadePlay', function (_next, position, complete) {
    cancelFade(this);
    const manager = SoundLocator.getService();
    const volume = this.get_originalVolume() * (manager?.get_musicVolume() ?? 1);
    if (this.isPlaying) {
      this.set_volume(volume);
      complete?.();
    } else if (paused.has(this)) startFade(this, position, volume, complete);
    else complete?.();
  });
  reflection.around(SoundObject.prototype, 'fadeStop', function (_next, complete) {
    cancelFade(this);
    if (!this.sc) {
      this.stop();
      complete?.();
      return;
    }
    const generation = generations.get(this);
    fading.set(this, { volume: 0, stop: true });
    TweenMax.to(this, 3, {
      volume: 0,
      onComplete: () => {
        if (generations.get(this) !== generation) return;
        this.stop();
        complete?.();
      },
    });
  });
  for (const method of ['playObject', 'resume'] as const) {
    reflection.around(SoundObject.prototype, method, function (next, volume, loop = false) {
      // Adopt older native effects before a new playback changes the shared loop flag.
      for (const channel of new Set([
        ...this.soundChannels,
        ...(this.isPlaying && this.sc ? [this.sc] : []),
      ]))
        if (!owners.has(channel)) track(this, channel, this.loop);
      let channel: SoundChannel | null;
      if (method === 'playObject') {
        cancelFade(this);
        if (!this.multipleAllowed && this.isPlaying && this.sc) {
          this.loop = loop;
          this.set_volume(volume);
          track(this, this.sc, loop);
          return this.sc;
        }
        if (!playbackClock.accept(this, this.multipleAllowed, this.oldTime)) return null;
        // Keep the timestamp native code expects when this plugin is disabled.
        this.oldTime = Date.now();
        this.loop = loop;
        this.position = 0;
        paused.delete(this);
        channel = Sound.prototype.play.call(this, 0, 0, new SoundTransform(volume));
        if (channel) {
          this.sc = channel;
          this.isPlaying = true;
          this._volume = volume;
        }
      } else {
        if (!this.isPlaying && this.sc && !paused.has(this)) {
          paused.set(this, this.sc);
          this.sc = null;
        }
        cancelFade(this);
        this.loop = loop;
        if (this.isPlaying && this.sc) {
          this.set_volume(volume);
          track(this, this.sc, loop);
          return this.sc;
        }
        if (!paused.has(this)) return this.playObject(volume, loop);
        startFade(this, this.position, volume);
        return this.sc;
      }
      if (channel) track(this, channel, loop);
      return channel;
    });
  }
  reflection.around(SoundObject.prototype, 'pause', function (next) {
    cancelFade(this);
    const current = this.sc;
    if (current) paused.set(this, current);
    const channels = new Set(this.soundChannels);
    if (current) channels.add(current);
    // Let native pause capture position, then retire its stopped channel.
    next();
    this.sc = null;
    this.soundChannels.length = 0;
    for (const channel of channels) {
      detach(this, channel);
      if (channel !== current) channel.stop();
    }
  });
  reflection.around(SoundObject.prototype, 'stop', function () {
    cancelFade(this);
    paused.delete(this);
    const channels = new Set(this.soundChannels);
    if (this.sc) channels.add(this.sc);
    this.soundChannels.length = 0;
    this.sc = null;
    this.isPlaying = false;
    this.loop = false;
    this.position = 0;
    for (const channel of channels) {
      detach(this, channel);
      channel.stop();
    }
  });
  const service = SoundLocator.getService();
  if (reflection.is(service, 'sound.SoundManager')) {
    for (const sound of Object.values(service.soundObjects.h)) {
      if (sound.isPlaying) {
        for (const channel of new Set([...sound.soundChannels, ...(sound.sc ? [sound.sc] : [])]))
          track(sound, channel, sound.loop);
      } else if (sound.sc) {
        paused.set(sound, sound.sc);
        sound.sc = null;
      }
    }
  }
  api.defer(() => {
    for (const [sound, fade] of [...fading]) {
      cancelFade(sound);
      if (fade.stop) sound.stop();
      else sound.set_volume(fade.volume);
    }
    for (const [channel, owner] of owners) {
      channel.removeEventListener('soundComplete', owner.complete);
      const native = owner.loop ? originalRestart : originalComplete;
      channel.addEventListener('soundComplete', reflection.bound(owner.sound, native));
    }
    owners.clear();
    for (const [sound, channel] of paused) {
      if (!sound.sc && !sound.isPlaying) sound.sc = channel;
    }
    paused.clear();
  });
}
