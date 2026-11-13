import { RadioStreamURL } from './RadioStreamURL';

export interface RadioSoundChannel {
  readonly position: number;
  volume: number;
  onComplete(callback: () => void): () => void;
  stop(): void;
}

export interface RadioSound {
  /** Duration decoded so far, in milliseconds; never metadata's estimated full duration. */
  readonly length: number;
  readonly bytesLoaded: number;
  readonly isBuffering: boolean;
  onComplete(callback: () => void): () => void;
  onProgress(callback: () => void): () => void;
  onFailure(callback: () => void): () => void;
  load(url: string, bufferMs?: number): void;
  play(position: number, volume: number): RadioSoundChannel | null;
  close(): void;
}

export interface PreparedRadioAudio {
  readonly url: string;
  readonly exists: boolean;
  readonly isDirectory: boolean;
  readonly extension: string;
  readonly size: number;
}

/** Source RadioAudio state machine; platform sound IO is the only replaced boundary. */
export class RadioAudio {
  private sound: RadioSound | null = null;
  private channel: RadioSoundChannel | null = null;
  private soundListeners: (() => void)[] = [];
  private channelListener: (() => void) | null = null;
  private loaded = false;
  private ended = false;
  private streaming = false;
  private downloadComplete = false;
  private totalDuration = 0;
  private requestedPosition = 0;
  private receivedBytes = 0;
  private lastDataAt = 0;
  private loadedCallback: (() => void) | null = null;
  private failedCallback: ((message: string) => void) | null = null;
  private deadline = 0;
  private lastCorrection = 0;
  private track = '';
  status = 'Stopped';

  constructor(
    private createSound: () => RadioSound,
    private now: () => number = () => performance.now(),
  ) {}

  get videoId(): string {
    return this.track;
  }
  get ready(): boolean {
    return this.loaded;
  }
  get playing(): boolean {
    return !!this.channel && !!this.sound && !this.sound.isBuffering && this.channel.volume > 0;
  }
  get durationMs(): number {
    return this.streaming ? this.totalDuration : this.loaded && this.sound ? this.sound.length : 0;
  }

  load(
    id: string,
    file: PreparedRadioAudio | null,
    onReady: () => void,
    onError: (message: string) => void,
  ): void {
    this.clear();
    this.loadedCallback = onReady;
    this.failedCallback = onError;
    this.track = id;
    try {
      if (
        !file ||
        !file.exists ||
        file.isDirectory ||
        file.extension !== 'mp3' ||
        file.size <= 0 ||
        file.size > 40 * 1024 * 1024
      )
        throw Error('Invalid prepared audio');
      const sound = this.attachSound(false);
      this.deadline = this.now() + 15000;
      this.status = 'Loading audio';
      sound.load(file.url);
    } catch {
      this.fail('Prepared audio could not be opened.');
    }
  }

  loadStream(
    id: string,
    url: string,
    duration: number,
    position: number,
    onReady: () => void,
    onError: (message: string) => void,
  ): void {
    this.clear();
    this.track = id;
    this.loadedCallback = onReady;
    this.failedCallback = onError;
    try {
      if (
        !RadioStreamURL.valid(url, id) ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 1200000
      )
        throw Error('Invalid local stream');
      this.streaming = true;
      this.totalDuration = duration;
      this.requestedPosition = Number.isFinite(position)
        ? Math.max(0, Math.min(duration, position))
        : 0;
      this.lastDataAt = this.now();
      const sound = this.attachSound(true);
      this.status = 'Buffering audio';
      sound.load(url, 5000);
    } catch {
      this.fail('Audio streaming could not start.');
    }
  }

  private attachSound(streaming: boolean): RadioSound {
    const sound = (this.sound = this.createSound());
    this.soundListeners.push(
      sound.onComplete(() => {
        if (this.sound === sound) this.onLoaded();
      }),
    );
    this.soundListeners.push(
      sound.onFailure(() => {
        if (this.sound === sound) this.fail('Audio loading failed.');
      }),
    );
    if (streaming)
      this.soundListeners.push(
        sound.onProgress(() => {
          if (this.sound !== sound) return;
          if (sound.bytesLoaded > 40 * 1024 * 1024) {
            this.fail('Audio stream exceeded its size limit.');
            return;
          }
          if (sound.bytesLoaded > this.receivedBytes) {
            this.receivedBytes = sound.bytesLoaded;
            this.lastDataAt = this.now();
          }
          this.updateStreamReady();
        }),
      );
    return sound;
  }

  private updateStreamReady(): void {
    if (!this.streaming || this.loaded || !this.sound) return;
    const needed = Math.min(this.totalDuration, this.requestedPosition + 5000);
    if (
      !this.downloadComplete &&
      (!Number.isFinite(this.sound.length) || this.sound.length < needed - 100)
    )
      return;
    this.markReady();
  }

  private markReady(): void {
    this.loaded = true;
    this.status = 'Ready';
    const callback = this.loadedCallback;
    this.loadedCallback = null;
    callback?.();
  }

  private onLoaded(): void {
    const length = this.sound!.length;
    if (!Number.isFinite(length) || length <= 0 || length > 1201000) {
      this.fail('Prepared audio has an unsupported duration.');
      return;
    }
    if (this.streaming && length + 1500 < this.totalDuration) {
      this.fail('Audio stream ended before the complete song arrived.');
      return;
    }
    this.downloadComplete = true;
    if (!this.loaded) this.markReady();
  }

  sync(positionMs: number, playing: boolean, volume: number): void {
    if (!this.sound) return;
    if (this.streaming) {
      this.requestedPosition = Number.isFinite(positionMs)
        ? Math.max(0, Math.min(this.totalDuration, positionMs))
        : 0;
      if (!this.downloadComplete && this.now() - this.lastDataAt > 20000) {
        this.fail('Audio stream stopped receiving data.');
        return;
      }
      this.updateStreamReady();
      if (!this.sound) return;
    }
    if (!this.loaded) {
      if (!this.streaming && this.now() > this.deadline) this.fail('Audio loading timed out.');
      else if (this.streaming) this.status = 'Buffering audio';
      return;
    }
    if (!playing || !Number.isFinite(positionMs) || positionMs < 0) {
      this.pause();
      return;
    }
    if (
      this.streaming &&
      !this.downloadComplete &&
      ((this.channel !== null && this.sound.isBuffering) ||
        this.sound.length <
          Math.min(this.totalDuration, positionMs + (this.channel === null ? 5000 : 250)) - 100)
    ) {
      this.stopChannel();
      this.loaded = false;
      this.status = 'Buffering audio';
      return;
    }
    const length =
      this.streaming && !this.downloadComplete ? this.totalDuration : this.sound.length;
    if (this.ended && this.downloadComplete && positionMs >= length - 900) {
      this.status = 'Waiting for next track';
      return;
    }
    if (positionMs >= length - 30) {
      this.pause();
      this.ended = this.downloadComplete;
      this.status = 'Waiting for next track';
      return;
    }
    const gain = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    try {
      if (
        this.channel &&
        Math.abs(this.channel.position - positionMs) > 900 &&
        this.now() - this.lastCorrection > 3000
      )
        this.stopChannel();
      if (!this.channel) {
        const channel = (this.channel = this.sound.play(positionMs, gain));
        if (!channel) {
          this.fail('No audio channel is available.');
          return;
        }
        this.channelListener = channel.onComplete(() => {
          if (this.channel !== channel) return;
          this.stopChannel();
          if (this.streaming && !this.downloadComplete) {
            this.loaded = false;
            this.ended = false;
            this.status = 'Buffering audio';
          } else {
            this.ended = true;
            this.status = 'Waiting for next track';
          }
        });
        this.lastCorrection = this.now();
        this.ended = false;
      } else this.channel.volume = gain;
      this.status = 'Playing';
    } catch {
      this.fail('Audio playback failed.');
    }
  }

  pause(): void {
    this.stopChannel();
    if (this.loaded) this.status = 'Paused';
  }
  private stopChannel(): void {
    const channel = this.channel;
    if (!channel) return;
    this.channel = null;
    this.channelListener?.();
    this.channelListener = null;
    try {
      channel.stop();
    } catch {
      /* An already stopped native channel needs no further action. */
    }
  }
  private fail(message: string): void {
    const callback = this.failedCallback;
    this.clear();
    this.status = message;
    callback?.(message);
  }
  clear(): void {
    this.stopChannel();
    const sound = this.sound;
    this.sound = null;
    for (const off of this.soundListeners.splice(0).reverse()) off();
    try {
      sound?.close();
    } catch {
      /* Loading may already have closed the sound. */
    }
    this.loaded = this.ended = this.streaming = this.downloadComplete = false;
    this.totalDuration = this.requestedPosition = this.receivedBytes = this.lastDataAt = 0;
    this.track = '';
    this.loadedCallback = this.failedCallback = null;
    this.status = 'Stopped';
  }
  dispose(): void {
    this.clear();
  }
}
